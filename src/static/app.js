document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const adminRequiredNote = document.getElementById("admin-required-note");
  const userMenuToggle = document.getElementById("user-menu-toggle");
  const userMenu = document.getElementById("user-menu");
  const authStatusText = document.getElementById("auth-status-text");
  const openLoginButton = document.getElementById("open-login");
  const logoutButton = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginButton = document.getElementById("cancel-login");

  let authToken = localStorage.getItem("adminAuthToken") || "";
  let adminUsername = localStorage.getItem("adminUsername") || "";

  function isAdminAuthenticated() {
    return Boolean(authToken);
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setAuthState({ token = "", username = "" }) {
    authToken = token;
    adminUsername = username;

    if (token) {
      localStorage.setItem("adminAuthToken", token);
      localStorage.setItem("adminUsername", username);
      authStatusText.textContent = `Logged in as ${username}`;
      openLoginButton.classList.add("hidden");
      logoutButton.classList.remove("hidden");
      signupForm.querySelector("button[type='submit']").disabled = false;
      adminRequiredNote.classList.add("hidden");
    } else {
      localStorage.removeItem("adminAuthToken");
      localStorage.removeItem("adminUsername");
      authStatusText.textContent = "Viewing as student";
      openLoginButton.classList.remove("hidden");
      logoutButton.classList.add("hidden");
      signupForm.querySelector("button[type='submit']").disabled = true;
      adminRequiredNote.classList.remove("hidden");
    }
  }

  function getAuthHeaders() {
    if (!isAdminAuthenticated()) {
      return {};
    }

    return {
      Authorization: `Bearer ${authToken}`,
    };
  }

  async function verifySession() {
    if (!authToken) {
      setAuthState({ token: "", username: "" });
      return;
    }

    try {
      const response = await fetch("/auth/status", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setAuthState({ token: "", username: "" });
        return;
      }

      const result = await response.json();
      setAuthState({ token: authToken, username: result.username || adminUsername });
    } catch (error) {
      setAuthState({ token: "", username: "" });
      console.error("Error verifying session:", error);
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      const isAdmin = isAdminAuthenticated();

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}" ${
                        isAdmin ? "" : "disabled"
                      }>❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          setAuthState({ token: "", username: "" });
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!isAdminAuthenticated()) {
      showMessage("Teacher login is required to register students.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          setAuthState({ token: "", username: "" });
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuToggle.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });

  openLoginButton.addEventListener("click", () => {
    userMenu.classList.add("hidden");
    loginModal.classList.remove("hidden");
  });

  cancelLoginButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();
      if (response.ok) {
        setAuthState({ token: result.token, username: result.username });
        loginModal.classList.add("hidden");
        loginForm.reset();
        showMessage(`Welcome, ${result.username}`, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "Login failed", "error");
      }
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const result = await response.json();
        showMessage(result.detail || "Logout failed", "error");
        return;
      }

      setAuthState({ token: "", username: "" });
      userMenu.classList.add("hidden");
      showMessage("Logged out", "success");
      fetchActivities();
    } catch (error) {
      showMessage("Failed to logout. Please try again.", "error");
      console.error("Error logging out:", error);
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!userMenuContainerContains(target) && !userMenu.classList.contains("hidden")) {
      userMenu.classList.add("hidden");
    }
  });

  function userMenuContainerContains(target) {
    const container = document.getElementById("user-menu-container");
    return container.contains(target);
  }

  // Initialize app
  setAuthState({ token: authToken, username: adminUsername });
  verifySession().finally(fetchActivities);
});

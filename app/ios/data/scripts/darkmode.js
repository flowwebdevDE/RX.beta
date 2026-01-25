document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("darkmode-toggle");

  // Zustand aus localStorage laden
  const darkmode = localStorage.getItem("darkmode");

  if (darkmode === "enabled") {
    document.body.classList.add("darkmode");
  }

  // Button-Klick
  button.addEventListener("click", () => {
    document.body.classList.toggle("darkmode");

    // Zustand speichern
    if (document.body.classList.contains("darkmode")) {
      localStorage.setItem("darkmode", "enabled");
    } else {
      localStorage.setItem("darkmode", "disabled");
    }
  });
});

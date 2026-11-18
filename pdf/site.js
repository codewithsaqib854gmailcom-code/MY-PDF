		const navToggle = document.getElementById("nav-toggle");
		const navLinks = document.getElementById("nav-links");

		if (navToggle && navLinks) {
			function closeNavigation() {
				navLinks.classList.remove("open");
				navToggle.setAttribute("aria-expanded", "false");
				navToggle.setAttribute("aria-label", "Open navigation menu");
			}

			navToggle.addEventListener("click", () => {
				const isOpen = navLinks.classList.toggle("open");
				navToggle.setAttribute("aria-expanded", String(isOpen));
				navToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
			});

			navLinks.querySelectorAll("a").forEach(link => link.addEventListener("click", closeNavigation));
			document.addEventListener("keydown", event => {
				if (event.key === "Escape" && navLinks.classList.contains("open")) {
					closeNavigation();
					navToggle.focus();
				}
			});
		}

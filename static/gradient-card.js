// Animações adicionais dos cartões

document.addEventListener("DOMContentLoaded", () => {

    const cards = document.querySelectorAll(".gradient-card");

    cards.forEach(card => {

        card.addEventListener("mouseenter", () => {
            card.style.cursor = "pointer";
        });

    });

});
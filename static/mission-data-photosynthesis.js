document.addEventListener("DOMContentLoaded", () => {

    const mascot = document.querySelector(".mascot");
    const speech = document.querySelector(".speech");
    const continueButton = document.querySelector(".continue-button");

    if (continueButton) {

        continueButton.addEventListener("click", () => {

            speech.innerHTML = `
                <strong>Muito bem, aprendiz! 🔎</strong>

                <p>
                    Já percebeste como a luz é importante.
                    Agora vamos descobrir o que acontece
                    aos eletrões.
                </p>

                <p>
                    Preparado para continuar a aventura? ☀️
                </p>
            `;

            if (mascot) {
                mascot.style.transform = "translateY(-10px)";
                
                setTimeout(() => {
                    mascot.style.transform = "translateY(0)";
                }, 350);
            }

        });

    }

});
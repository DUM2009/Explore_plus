/**
 * Mission Data Structure
 * Contains all mission content, quizzes, and progression logic
 */

const missionData = {
    id: "biology-code-of-life",
    title: "🧬 The Code of Life",
    description: "Discover the secrets of biology and how life works",
    totalXP: 500,
    sections: [
        {
            id: "intro-biology",
            title: "What is Biology?",
            icon: "🔬",
            xpReward: 50,
            content: `
                <div class="section-content">
                    <h2>What is Biology? 🔬</h2>
                    <p>Biology is the science that studies <strong>living organisms</strong> and how they work.</p>
                    
                    <div class="info-card">
                        <h3>Key Definition</h3>
                        <p>The word "Biology" comes from two Greek words:</p>
                        <ul>
                            <li><strong>Bio</strong> = Life</li>
                            <li><strong>Logos</strong> = Study or Science</li>
                        </ul>
                        <p>So <strong>Biology = The Study of Life</strong></p>
                    </div>

                    <div class="illustration-placeholder">
                        <img src="assets/images/Biology image.jpg" alt="Ilustração de biologia: célula com ADN e elementos científicos" style="width: 100%; border-radius: 12px; margin: 20px 0;">
                    </div>

                    <div class="learning-points">
                        <h3>What biologists study:</h3>
                        <div class="point-grid">
                            <div class="point-card">
                                <span class="emoji">🌿</span>
                                <p>Plants</p>
                            </div>
                            <div class="point-card">
                                <span class="emoji">🦁</span>
                                <p>Animals</p>
                            </div>
                            <div class="point-card">
                                <span class="emoji">🧬</span>
                                <p>Genetics</p>
                            </div>
                            <div class="point-card">
                                <span class="emoji">🌍</span>
                                <p>Ecosystems</p>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            quiz: {
                question: "What does 'Biology' mean?",
                options: [
                    { text: "The study of life", correct: true },
                    { text: "The study of chemicals", correct: false },
                    { text: "The study of rocks", correct: false },
                    { text: "The study of weather", correct: false }
                ],
                feedback: {
                    correct: "Correct! Biology literally means 'the study of life' (Bio = Life, Logos = Study)",
                    incorrect: "Not quite. Think about what 'Bio' means... it's related to life!"
                }
            }
        },
        {
            id: "living-organisms",
            title: "Living Organisms",
            icon: "🌱",
            xpReward: 50,
            content: `
                <div class="section-content">
                    <h2>What are Living Organisms? 🌱</h2>
                    <p>Living organisms are all the creatures, plants, and even tiny life forms we can see around us.</p>
                    
                    <div class="info-card">
                        <h3>Examples of Living Organisms</h3>
                        <div class="organisms-grid">
                            <div class="organism-item">
                                <span class="emoji">🌳</span>
                                <p>Trees</p>
                            </div>
                            <div class="organism-item">
                                <span class="emoji">🦋</span>
                                <p>Insects</p>
                            </div>
                            <div class="organism-item">
                                <span class="emoji">🐠</span>
                                <p>Fish</p>
                            </div>
                            <div class="organism-item">
                                <span class="emoji">👨‍👩‍👧‍👦</span>
                                <p>Humans</p>
                            </div>
                            <div class="organism-item">
                                <span class="emoji">🌾</span>
                                <p>Grass</p>
                            </div>
                            <div class="organism-item">
                                <span class="emoji">🍄</span>
                                <p>Fungi</p>
                            </div>
                        </div>
                    </div>

                    <div class="illustration-placeholder">
                        <img src="https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=600" alt="Living Organisms" style="width: 100%; border-radius: 12px; margin: 20px 0;">
                    </div>

                    <div class="info-card">
                        <h3>Did You Know?</h3>
                        <p>There are millions of different species of living organisms on Earth! Scientists estimate there are between 5 million to 1 billion different species.</p>
                    </div>
                </div>
            `,
            quiz: {
                question: "Which of the following is a living organism?",
                options: [
                    { text: "A rock", correct: false },
                    { text: "A tree", correct: true },
                    { text: "Water", correct: false },
                    { text: "Sunlight", correct: false }
                ],
                feedback: {
                    correct: "Great! A tree is alive because it grows, reproduces, and responds to its environment.",
                    incorrect: "Think about what makes something 'alive'. Does a rock grow or reproduce?"
                }
            }
        },
        {
            id: "characteristics-life",
            title: "Characteristics of Living Things",
            icon: "⭐",
            xpReward: 75,
            content: `
                <div class="section-content">
                    <h2>7 Characteristics of Living Things ⭐</h2>
                    <p>All living things share certain features that make them alive. Let's explore each one:</p>
                    
                    <div class="characteristics-list">
                        <div class="char-item">
                            <span class="char-number">1️⃣</span>
                            <h3>Organization</h3>
                            <p>Living things are organized, often made of cells working together.</p>
                        </div>
                        <div class="char-item">
                            <span class="char-number">2️⃣</span>
                            <h3>Metabolism</h3>
                            <p>Living things use energy to perform life activities (eating, moving, thinking).</p>
                        </div>
                        <div class="char-item">
                            <span class="char-number">3️⃣</span>
                            <h3>Growth</h3>
                            <p>Living things increase in size and complexity over time.</p>
                        </div>
                        <div class="char-item">
                            <span class="char-number">4️⃣</span>
                            <h3>Reproduction</h3>
                            <p>Living things create new living things (offspring).</p>
                        </div>
                        <div class="char-item">
                            <span class="char-number">5️⃣</span>
                            <h3>Response to Environment</h3>
                            <p>Living things react to changes in their surroundings.</p>
                        </div>
                        <div class="char-item">
                            <span class="char-number">6️⃣</span>
                            <h3>Homeostasis</h3>
                            <p>Living things maintain stable internal conditions.</p>
                        </div>
                        <div class="char-item">
                            <span class="char-number">7️⃣</span>
                            <h3>Evolution</h3>
                            <p>Living things change over many generations.</p>
                        </div>
                    </div>

                    <div class="illustration-placeholder">
                        <img src="https://images.unsplash.com/photo-1517457373614-b7152f800fd1?w=600" alt="Life" style="width: 100%; border-radius: 12px; margin: 20px 0;">
                    </div>
                </div>
            `,
            quiz: {
                question: "Which is NOT a characteristic of living things?",
                options: [
                    { text: "Growth", correct: false },
                    { text: "Reproduction", correct: false },
                    { text: "Being made of plastic", correct: true },
                    { text: "Using energy", correct: false }
                ],
                feedback: {
                    correct: "Excellent! Living things are made of natural materials, not plastic.",
                    incorrect: "Think about what all living things do. They grow, reproduce, and use energy!"
                }
            }
        },
        {
            id: "cells-unit-life",
            title: "Cells: The Unit of Life",
            icon: "🔬",
            xpReward: 75,
            content: `
                <div class="section-content">
                    <h2>Cells: The Basic Unit of Life 🔬</h2>
                    <p>Cells are the smallest unit of life. All living organisms are made of one or more cells.</p>
                    
                    <div class="info-card">
                        <h3>What is a Cell?</h3>
                        <p>A <strong>cell</strong> is the smallest unit of life that can function independently. It's like the 'building block' of all living things.</p>
                    </div>

                    <div class="cell-types">
                        <h3>Two Main Types of Cells:</h3>
                        <div class="type-grid">
                            <div class="type-card">
                                <h4>🦠 Prokaryotic Cells</h4>
                                <ul>
                                    <li>No nucleus</li>
                                    <li>Smaller</li>
                                    <li>Found in bacteria</li>
                                </ul>
                            </div>
                            <div class="type-card">
                                <h4>🧬 Eukaryotic Cells</h4>
                                <ul>
                                    <li>Has nucleus</li>
                                    <li>Larger</li>
                                    <li>Found in animals & plants</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="illustration-placeholder">
                        <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600" alt="Cells" style="width: 100%; border-radius: 12px; margin: 20px 0;">
                    </div>

                    <div class="info-card">
                        <h3>Amazing Cell Facts</h3>
                        <ul>
                            <li>Your body contains approximately 37 trillion cells!</li>
                            <li>Most cells are too small to see without a microscope</li>
                            <li>A single cell can be a complete living organism</li>
                            <li>Cells need food and oxygen to survive</li>
                        </ul>
                    </div>
                </div>
            `,
            quiz: {
                question: "What is the smallest unit of life?",
                options: [
                    { text: "DNA", correct: false },
                    { text: "Cell", correct: true },
                    { text: "Atom", correct: false },
                    { text: "Protein", correct: false }
                ],
                feedback: {
                    correct: "Perfect! The cell is the basic unit of life. All living things are made of cells.",
                    incorrect: "Remember: the CELL is the basic unit of life!"
                }
            }
        },
        {
            id: "dna-genetic-code",
            title: "DNA: The Genetic Code",
            icon: "🧬",
            xpReward: 100,
            content: `
                <div class="section-content">
                    <h2>DNA: The Genetic Code 🧬</h2>
                    <p>DNA is the molecule that contains the instructions for creating and maintaining all living organisms.</p>
                    
                    <div class="info-card">
                        <h3>What is DNA?</h3>
                        <p><strong>DNA (Deoxyribonucleic Acid)</strong> is a molecule that carries the genetic code for all life.</p>
                        <p>Think of it like a <strong>instruction manual</strong> that tells your cells how to work.</p>
                    </div>

                    <div class="dna-facts">
                        <h3>Key Facts About DNA:</h3>
                        <div class="fact-grid">
                            <div class="fact-item">
                                <h4>Structure</h4>
                                <p>DNA is shaped like a <strong>double helix</strong> (twisted ladder)</p>
                            </div>
                            <div class="fact-item">
                                <h4>Location</h4>
                                <p>Found in the <strong>nucleus</strong> of cells</p>
                            </div>
                            <div class="fact-item">
                                <h4>Information</h4>
                                <p>Contains <strong>genes</strong> that code for proteins</p>
                            </div>
                            <div class="fact-item">
                                <h4>Inheritance</h4>
                                <p>Passed from <strong>parents to children</strong></p>
                            </div>
                        </div>
                    </div>

                    <div class="illustration-placeholder">
                        <img src="assets/images/dna-double-helix.svg" alt="Dupla hélice do ADN - estrutura da molécula que contém a informação genética" style="width: 100%; border-radius: 12px; margin: 20px 0;">
                    </div>

                    <div class="info-card">
                        <h3>Did You Know?</h3>
                        <ul>
                            <li>Your DNA is unique to you (like a fingerprint)</li>
                            <li>You share 99.9% of your DNA with other humans</li>
                            <li>You also share DNA with all other living things!</li>
                            <li>Each cell in your body (except red blood cells) contains your complete DNA</li>
                        </ul>
                    </div>
                </div>
            `,
            quiz: {
                question: "What does DNA do?",
                options: [
                    { text: "Provides energy to cells", correct: false },
                    { text: "Carries genetic instructions for life", correct: true },
                    { text: "Fights infections", correct: false },
                    { text: "Moves cells around", correct: false }
                ],
                feedback: {
                    correct: "Correct! DNA contains the instructions that tell your cells how to build and maintain your body.",
                    incorrect: "Think about what we learned: DNA is like an instruction manual for life."
                }
            }
        },
        {
            id: "why-biology-matters",
            title: "Why Biology Matters",
            icon: "💡",
            xpReward: 100,
            content: `
                <div class="section-content">
                    <h2>Why Biology Matters in Everyday Life 💡</h2>
                    <p>Biology isn't just about studying organisms—it impacts your life every single day!</p>
                    
                    <div class="applications">
                        <h3>Biology in Real Life:</h3>
                        <div class="app-grid">
                            <div class="app-card">
                                <span class="app-emoji">🏥</span>
                                <h4>Medicine</h4>
                                <p>Biology helps doctors understand and treat diseases</p>
                            </div>
                            <div class="app-card">
                                <span class="app-emoji">🍎</span>
                                <h4>Nutrition</h4>
                                <p>Understanding how food nourishes your body</p>
                            </div>
                            <div class="app-card">
                                <span class="app-emoji">💪</span>
                                <h4>Exercise</h4>
                                <p>How your muscles and heart work during exercise</p>
                            </div>
                            <div class="app-card">
                                <span class="app-emoji">🌍</span>
                                <h4>Environment</h4>
                                <p>Understanding ecosystems and protecting nature</p>
                            </div>
                            <div class="app-card">
                                <span class="app-emoji">🧬</span>
                                <h4>Genetics</h4>
                                <p>Understanding inherited traits and genetic diseases</p>
                            </div>
                            <div class="app-card">
                                <span class="app-emoji">🔬</span>
                                <h4>Innovation</h4>
                                <p>Creating new medicines and technologies</p>
                            </div>
                        </div>
                    </div>

                    <div class="illustration-placeholder">
                        <img src="https://images.unsplash.com/photo-1576091160647-112b886d0120?w=600" alt="Science" style="width: 100%; border-radius: 12px; margin: 20px 0;">
                    </div>

                    <div class="info-card">
                        <h3>Career Paths in Biology</h3>
                        <p>If you love biology, you could become:</p>
                        <ul>
                            <li>Doctor or Nurse</li>
                            <li>Biologist or Geneticist</li>
                            <li>Environmental Scientist</li>
                            <li>Pharmacist</li>
                            <li>Marine Biologist</li>
                            <li>Veterinarian</li>
                        </ul>
                    </div>
                </div>
            `,
            quiz: {
                question: "How does biology impact your life?",
                options: [
                    { text: "It only affects scientists", correct: false },
                    { text: "It impacts medicine, nutrition, environment, and more", correct: true },
                    { text: "It's not relevant to everyday life", correct: false },
                    { text: "Only doctors need to know biology", correct: false }
                ],
                feedback: {
                    correct: "Excellent! Biology touches every part of our lives—from the food we eat to the medicine that saves us.",
                    incorrect: "Think about all the ways science affects us: medicine, food, health, environment..."
                }
            }
        }
    ],
    finalQuiz: [
        {
            question: "What does 'Biology' literally mean?",
            options: [
                { text: "The study of life", correct: true },
                { text: "The study of chemicals", correct: false },
                { text: "The study of computers", correct: false },
                { text: "The study of physics", correct: false }
            ]
        },
        {
            question: "How many characteristics define living things?",
            options: [
                { text: "5", correct: false },
                { text: "7", correct: true },
                { text: "10", correct: false },
                { text: "3", correct: false }
            ]
        },
        {
            question: "What is the smallest unit of life?",
            options: [
                { text: "DNA", correct: false },
                { text: "Atom", correct: false },
                { text: "Cell", correct: true },
                { text: "Molecule", correct: false }
            ]
        },
        {
            question: "Which type of cell has a nucleus?",
            options: [
                { text: "Prokaryotic", correct: false },
                { text: "Bacterial", correct: false },
                { text: "Eukaryotic", correct: true },
                { text: "Viral", correct: false }
            ]
        },
        {
            question: "What is DNA's shape?",
            options: [
                { text: "Circle", correct: false },
                { text: "Double helix", correct: true },
                { text: "Square", correct: false },
                { text: "Triangle", correct: false }
            ]
        },
        {
            question: "How much DNA do all humans share?",
            options: [
                { text: "50%", correct: false },
                { text: "75%", correct: false },
                { text: "99.9%", correct: true },
                { text: "100%", correct: false }
            ]
        },
        {
            question: "Where is DNA located in a cell?",
            options: [
                { text: "In the cell membrane", correct: false },
                { text: "In the nucleus", correct: true },
                { text: "In the cytoplasm", correct: false },
                { text: "Outside the cell", correct: false }
            ]
        },
        {
            question: "Which is a living characteristic?",
            options: [
                { text: "Being made of plastic", correct: false },
                { text: "Growing and reproducing", correct: true },
                { text: "Not needing energy", correct: false },
                { text: "Not changing", correct: false }
            ]
        },
        {
            question: "Approximately how many cells are in your body?",
            options: [
                { text: "1 million", correct: false },
                { text: "37 billion", correct: false },
                { text: "37 trillion", correct: true },
                { text: "1 trillion", correct: false }
            ]
        },
        {
            question: "Which field of study uses biology?",
            options: [
                { text: "Medicine", correct: false },
                { text: "Environmental science", correct: false },
                { text: "Nutrition", correct: false },
                { text: "All of the above", correct: true }
            ]
        }
    ]
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = missionData;
}

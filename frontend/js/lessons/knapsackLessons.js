const knapsackLessons = [
  {
    id: "knapsack-lesson-1",
    title: "Why greedy fails",
    description: "Greedy can miss the optimum.",
    unit: "knapsack",
    quizId: "knapsackQuiz",
    narration: { intro: "Greedy takes items 1 and 2 for 160; optimum is 220." },
    checkpoints: [
      { prompt: "Is greedy optimal here?", choices: ["Yes", "No"], answer: 1, atStep: 1 }
    ]
  }
];
export { knapsackLessons };
export const KNAPSACK_LESSONS = knapsackLessons;

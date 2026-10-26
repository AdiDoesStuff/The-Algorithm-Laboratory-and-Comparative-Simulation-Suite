const growthLessons = [
  {
    id: "growth-lesson-1",
    title: "Recursion tree of merge sort",
    description: "Watch merge sort build its recursion tree.",
    unit: "growth",
    quizId: "growthQuiz",
    narration: { intro: "Merge sort on 8 elements makes 15 calls." },
    checkpoints: [
      { prompt: "How many calls total?", choices: ["7", "15", "31"], answer: 1, atStep: 1 }
    ]
  }
];
export { growthLessons };
export const GROWTH_LESSONS = growthLessons;

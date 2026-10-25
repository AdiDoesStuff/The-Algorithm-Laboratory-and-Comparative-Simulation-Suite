const nqueensLessons = [
  {
    id: "nqueens-lesson-1",
    title: "Placing queens",
    description: "Backtracking on the board.",
    unit: "nqueens",
    quizId: "nqueensQuiz",
    narration: { intro: "n=4 first solution columns [1,3,0,2]." },
    checkpoints: [
      { prompt: "How many solutions for n=4?", choices: ["1", "2", "4"], answer: 1, atStep: 1 }
    ]
  }
];
export { nqueensLessons };
export const NQUEENS_LESSONS = nqueensLessons;

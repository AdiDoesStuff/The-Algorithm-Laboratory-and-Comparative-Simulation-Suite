export const knapsackQuiz = {
    id: "knapsackQuiz",
    unitId: "knapsack",
    title: "0/1 Knapsack: check yourself",
    questions: [
        { id: "k-q1", topic: "Greedy", prompt: "Greedy knapsack on (10,60),(20,100),(30,120) cap 50 gives?", options: [{id:"a",text:"160"},{id:"b",text:"220"},{id:"c",text:"180"},{id:"d",text:"120"}], correctOptionId: "a", explanation: "Takes items 1,2." },
        { id: "k-q2", topic: "Greedy", prompt: "Optimum for that instance?", options: [{id:"a",text:"160"},{id:"b",text:"220"},{id:"c",text:"180"},{id:"d",text:"240"}], correctOptionId: "b", explanation: "Items 2,3." },
        { id: "k-q3", topic: "DP", prompt: "DP tie rule in AlgoLab?", options: [{id:"a",text:"take wins ties"},{id:"b",text:"skip wins ties"},{id:"c",text:"random"},{id:"d",text:"error"}], correctOptionId: "b", explanation: "Skip wins ties." },
        { id: "k-q4", topic: "DP", prompt: "Bottom-up cells computed for n items capacity C?", options: [{id:"a",text:"n*C"},{id:"b",text:"n*(C+1)"},{id:"c",text:"(n+1)*C"},{id:"d",text:"2^n"}], correctOptionId: "b", explanation: "n*(C+1)." },
        { id: "k-q5", topic: "DP", prompt: "Traceback take condition?", options: [{id:"a",text:"dp[i][w]!=dp[i-1][w]"},{id:"b",text:"dp[i][w]==dp[i-1][w]"},{id:"c",text:"value>best"},{id:"d",text:"weight<=cap"}], correctOptionId: "a", explanation: "Take iff differs." },
        { id: "k-q6", topic: "Top-down", prompt: "Top-down may compute fewer cells because?", options: [{id:"a",text:"memoization"},{id:"b",text:"sorting"},{id:"c",text:"pruning"},{id:"d",text:"greedy"}], correctOptionId: "a", explanation: "Memoization." },
        { id: "k-q7", topic: "B&B", prompt: "B&B hand instance optimum?", options: [{id:"a",text:"65"},{id:"b",text:"76"},{id:"c",text:"40"},{id:"d",text:"57"}], correctOptionId: "a", explanation: "65." },
        { id: "k-q8", topic: "B&B", prompt: "Nodes expanded in hand instance?", options: [{id:"a",text:"9"},{id:"b",text:"31"},{id:"c",text:"4"},{id:"d",text:"2"}], correctOptionId: "a", explanation: "9 of 31." },
        { id: "k-q9", topic: "B&B", prompt: "Pruned by bound count?", options: [{id:"a",text:"2"},{id:"b",text:"4"},{id:"c",text:"1"},{id:"d",text:"0"}], correctOptionId: "a", explanation: "2 by bound." },
        { id: "k-q10", topic: "B&B", prompt: "Bound comparison uses?", options: [{id:"a",text:"Fraction exact"},{id:"b",text:"float approx"},{id:"c",text:"int"},{id:"d",text:"string"}], correctOptionId: "a", explanation: "Fraction." }
    ]
};

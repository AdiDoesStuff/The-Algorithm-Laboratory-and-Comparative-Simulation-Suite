export const growthQuiz = {
    id: "growthQuiz",
    unitId: "growth",
    title: "Growth & recursion: check yourself",
    questions: [
        { id: "g-q1", topic: "Merge sort", prompt: "Merge sort on 8 elements makes how many calls?", options: [{id:"a",text:"7"},{id:"b",text:"15"},{id:"c",text:"31"},{id:"d",text:"8"}], correctOptionId: "b", explanation: "2n-1 = 15." },
        { id: "g-q2", topic: "Merge sort", prompt: "Depth of merge sort recursion for n=8?", options: [{id:"a",text:"2"},{id:"b",text:"3"},{id:"c",text:"4"},{id:"d",text:"8"}], correctOptionId: "b", explanation: "ceil(log2 8)=3." },
        { id: "g-q3", topic: "Quicksort", prompt: "Quicksort on a sorted array has chain depth?", options: [{id:"a",text:"log n"},{id:"b",text:"n"},{id:"c",text:"1"},{id:"d",text:"n/2"}], correctOptionId: "b", explanation: "Worst case n." },
        { id: "g-q4", topic: "Fibonacci", prompt: "Naive fib(5) makes how many calls?", options: [{id:"a",text:"9"},{id:"b",text:"15"},{id:"c",text:"5"},{id:"d",text:"31"}], correctOptionId: "b", explanation: "2*F(6)-1=15." },
        { id: "g-q5", topic: "Fibonacci", prompt: "Memoized fib(5) makes how many calls?", options: [{id:"a",text:"9"},{id:"b",text:"15"},{id:"c",text:"5"},{id:"d",text:"3"}], correctOptionId: "a", explanation: "2n-1=9." },
        { id: "g-q6", topic: "Fibonacci", prompt: "Memoized fib(5) cache hits?", options: [{id:"a",text:"3"},{id:"b",text:"4"},{id:"c",text:"0"},{id:"d",text:"5"}], correctOptionId: "a", explanation: "Measured 3." },
        { id: "g-q7", topic: "Growth", prompt: "Bubble sort comparisons double roughly how when n doubles?", options: [{id:"a",text:"2x"},{id:"b",text:"4x"},{id:"c",text:"8x"},{id:"d",text:"same"}], correctOptionId: "b", explanation: "O(n^2)." },
        { id: "g-q8", topic: "Growth", prompt: "Which metric is exact and deterministic?", options: [{id:"a",text:"median_ms"},{id:"b",text:"comparisons"},{id:"c",text:"wall-clock"},{id:"d",text:"runs_ms"}], correctOptionId: "b", explanation: "Comparison counts are exact." },
        { id: "g-q9", topic: "Recursion", prompt: "A cache-hit node shows which cue?", options: [{id:"a",text:"reused"},{id:"b",text:"pruned"},{id:"c",text:"new_node"},{id:"d",text:"selected"}], correctOptionId: "a", explanation: "reused role." },
        { id: "g-q10", topic: "Growth", prompt: "Bogo sort is excluded from benchmark because?", options: [{id:"a",text:"too slow"},{id:"b",text:"no counters"},{id:"c",text:"not sorted"},{id:"d",text:"no array"}], correctOptionId: "a", explanation: "Exponential." }
    ]
};

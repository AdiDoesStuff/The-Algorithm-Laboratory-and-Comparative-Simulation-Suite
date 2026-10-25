export const nqueensQuiz = {
    id: "nqueensQuiz",
    unitId: "nqueens",
    title: "N-Queens: check yourself",
    questions: [
        { id: "n-q1", topic: "Solution count", prompt: "N-Queens solutions for n=4?", options: [{id:"a",text:"2"},{id:"b",text:"10"},{id:"c",text:"4"},{id:"d",text:"92"}], correctOptionId: "a", explanation: "2." },
        { id: "n-q2", topic: "Solution count", prompt: "N-Queens solutions for n=5?", options: [{id:"a",text:"2"},{id:"b",text:"10"},{id:"c",text:"4"},{id:"d",text:"92"}], correctOptionId: "b", explanation: "10." },
        { id: "n-q3", topic: "Solution count", prompt: "N-Queens solutions for n=8?", options: [{id:"a",text:"2"},{id:"b",text:"10"},{id:"c",text:"4"},{id:"d",text:"92"}], correctOptionId: "d", explanation: "92." },
        { id: "n-q4", topic: "First solution", prompt: "First solution columns for n=4?", options: [{id:"a",text:"[1,3,0,2]"},{id:"b",text:"[0,2,1,3]"},{id:"c",text:"[2,0,3,1]"},{id:"d",text:"[3,1,2,0]"}], correctOptionId: "a", explanation: "[1,3,0,2]." },
        { id: "n-q5", topic: "First solution", prompt: "First solution columns for n=8?", options: [{id:"a",text:"[0,4,7,5,2,6,1,3]"},{id:"b",text:"[1,3,0,2,4,6,5,7]"},{id:"c",text:"[0,1,2,3,4,5,6,7]"},{id:"d",text:"[7,6,5,4,3,2,1,0]"}], correctOptionId: "a", explanation: "[0,4,7,5,2,6,1,3]." },
        { id: "n-q6", topic: "Conflict", prompt: "Conflict types include?", options: [{id:"a",text:"column, diagonal, anti-diagonal"},{id:"b",text:"row only"},{id:"c",text:"value only"},{id:"d",text:"none"}], correctOptionId: "a", explanation: "Three attack lines." },
        { id: "n-q7", topic: "Backtracking", prompt: "On no safe column in a row, search?", options: [{id:"a",text:"backtracks"},{id:"b",text:"skips row"},{id:"c",text:"places anyway"},{id:"d",text:"stops"}], correctOptionId: "a", explanation: "Backtrack." },
        { id: "n-q8", topic: "Stack", prompt: "Queens list is a?", options: [{id:"a",text:"stack"},{id:"b",text:"queue"},{id:"c",text:"set"},{id:"d",text:"map"}], correctOptionId: "a", explanation: "Stack." },
        { id: "n-q9", topic: "Threatened", prompt: "Threatened cells are those?", options: [{id:"a",text:"attacked by a placed queen"},{id:"b",text:"empty"},{id:"c",text:"occupied"},{id:"d",text:"random"}], correctOptionId: "a", explanation: "Attacked." },
        { id: "n-q10", topic: "Mode", prompt: "Mode 'first' does what?", options: [{id:"a",text:"stops at first solution"},{id:"b",text:"counts all"},{id:"c",text:"skips conflicts"},{id:"d",text:"random search"}], correctOptionId: "a", explanation: "Stops at first." }
    ]
};

// definitions.js

const definitions = [
    { term: "Algorithm", def: "A step-by-step set of instructions designed to perform a specific task or solve a particular problem." },
    { term: "Asymptotic Notation", def: "Mathematical tools (like <strong>Big O</strong>) used to describe the limiting behavior of a function when the argument tends towards a particular value or infinity." },
    { term: "Auxiliary Space", def: "The extra space or temporary space used by an algorithm, typically excluding the space used to store the input." },
    { term: "Average Case", def: "The expected amount of time or space an algorithm requires to execute on a typical input of size n, representing standard real-world conditions." },
    { term: "Best Case", def: "The scenario where the algorithm requires the minimum amount of time or space to execute (e.g., sorting an already sorted array)." },
    { term: "Big O Notation (O)", def: "Describes the upper bound of the time or space complexity of an algorithm. It gives the worst-case scenario." },
    { term: "Comparisons", def: "The operation of checking if one element in a data structure is greater than, less than, or equal to another. Minimizing this is often a key goal in sorting algorithms." },
    { term: "Data Structure", def: "A specialized format for organizing, processing, retrieving and storing data." },
    { term: "Divide and Conquer", def: "An algorithm design paradigm based on recursively breaking down a problem into two or more sub-problems of the same or related type, until these become simple enough to be solved directly." },
    { term: "Element", def: "A single piece of data stored within a data structure, like a number in an array that needs to be sorted." },
    { term: "In-place Algorithm", def: "An algorithm that transforms input using no auxiliary data structure. However, a small amount of extra storage space is allowed for auxiliary variables." },
    { term: "Partition", def: "The process of dividing a data structure into two or more parts based on a specific condition, commonly used in Quick Sort." },
    { term: "Pivot", def: "A specifically chosen element in an array used to partition the data in algorithms like Quick Sort." },
    { term: "Space Complexity", def: "The total amount of memory space an algorithm requires to run as a function of the length of the input." },
    { term: "Stable Sort", def: "A sorting algorithm that preserves the relative order of equal elements in the sorted output." },
    { term: "Swaps", def: "The operation of exchanging the positions of two elements within a data structure. A high amount of swaps can drastically affect performance." },
    { term: "Time Complexity", def: "The total amount of time an algorithm takes to run to completion, often expressed in Big O notation." },
    { term: "Worst Case", def: "The scenario where the algorithm requires the maximum amount of time or space to execute." }
];

// Sort alphabetically
definitions.sort((a, b) => a.term.localeCompare(b.term));

const definitionsGrid = document.getElementById('definitions-grid');
const searchInput = document.getElementById('search-input');

// Modal Elements
const overlay = document.getElementById('definition-modal');
const modalTitle = document.getElementById('modal-title');
const modalDef = document.getElementById('modal-def');

// Initialize and Render Pages
function renderCards(filterText = "") {
    // Clear container
    definitionsGrid.innerHTML = "";

    const filtered = definitions.filter(item => 
        item.term.toLowerCase().includes(filterText.toLowerCase()) || 
        item.def.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.forEach((item, index) => {
        // Create card element
        const card = document.createElement('div');
        card.className = `glossary-card ${filterText ? 'search-match' : ''}`;
        
        // Use custom dataset for ease of extracting data on click without stringifying
        card.dataset.term = item.term;
        card.dataset.def = item.def;
        
        card.innerHTML = `<h3 class="card-title">${item.term}</h3>`;
        
        // Add click listener to trigger modal
        card.addEventListener('click', () => {
            openModal(item.term, item.def);
        });

        definitionsGrid.appendChild(card);
    });
}

// Modal Logic
function openModal(term, def) {
    modalTitle.textContent = term;
    modalDef.innerHTML = def; // Render HTML like <strong> for definitions
    
    // Prevent body bounce/scrolling when modal is open
    document.body.style.overflow = "hidden";
    
    // Show modal
    overlay.classList.remove('hidden');
}

function closeModal() {
    overlay.classList.add('hidden');
    
    // Restore body scrolling
    document.body.style.overflow = "";
}

function closeModalOnOutsideClick(event) {
    if (event.target === overlay) {
        closeModal();
    }
}

// Keyboard accessible modal closing
window.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && !overlay.classList.contains('hidden')) {
        closeModal();
    }
});

// Search Logic
searchInput.addEventListener('input', (e) => {
    renderCards(e.target.value);
});

// Transition specific
function goBack() {
    const pageTransition = document.getElementById('page-transition');
    if (pageTransition) {
        pageTransition.classList.remove('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500); // Wait for transition
    } else {
        window.location.href = 'index.html';
    }
}

// Window init
window.onload = () => {
    // Initial Render
    renderCards();
    
    // Fade in overlay removal
    const pageTransition = document.getElementById('page-transition');
    if (pageTransition) {
        setTimeout(() => {
            pageTransition.classList.add('fade-out');
        }, 50);
    }
}

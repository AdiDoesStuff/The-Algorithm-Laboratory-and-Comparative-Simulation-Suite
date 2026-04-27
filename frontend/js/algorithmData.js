const algorithmDetails = {
    bubble: {
        name: "Bubble Sort",
        desc: "A simple algorithm that repeatedly steps through the list, compares adjacent elements, and swaps them if they are in the wrong order.",
        codeSnippet: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr`,
        timeBest: "O(n)", timeAvg: "O(n²)", timeWorst: "O(n²)",
        timeBestWhy: "If the array is already sorted, it still makes a single full pass of adjacent comparisons (≈ <strong>n</strong>) and does no work beyond that.",
        timeAvgWhy: "Two nested loops. For each pass over the array (≈ <strong>n</strong>), you may compare many adjacent pairs (up to ≈ <strong>n</strong>), giving ≈ <strong>n × n</strong> comparisons.",
        timeWorstWhy: "Worst case (reverse order) forces the inner loop to do almost the maximum comparisons on every pass, so the total comparisons sum to ≈ <strong>n²</strong>.",
        space: "O(1)", type: "Brute Force",
        spaceWhy: "It swaps elements inside the same array and only uses a few temporary variables (constant extra memory).",
        stability: "Stable", inplace: "In-place",
        observation: "Watch the red (comparing) indicators move pair by pair. You'll notice the largest unsorted element 'bubbles' all the way to the right end in each pass.",
        usecase: "Mostly used for educational purposes; can be fast if the array is already mostly sorted.",
        prosCons: "Pros: Very simple to understand. Cons: Extremely slow for large lists.",
        creator: "Unknown / Uncredited", date: "First published 1956 (Edward Friend)"
    },
    selection: {
        name: "Selection Sort",
        desc: "Divides the input list into two parts: a sorted sublist building up from left to right, and an unsorted sublist. It repeatedly finds the minimum element and puts it at the beginning.",
        codeSnippet: `def selection_sort(arr):
    for i in range(len(arr)):
        min_idx = i
        for j in range(i+1, len(arr)):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr`,
        timeBest: "O(n²)", timeAvg: "O(n²)", timeWorst: "O(n²)",
        timeBestWhy: "Even if the array is sorted, it still searches the remaining unsorted part for the minimum each time: \n(<strong>n−1</strong>) + (<strong>n−2</strong>) + ... + 1 = Θ(<strong>n²</strong>).",
        timeAvgWhy: "For each position <strong>i</strong>, it scans the rest of the array to find the minimum, so the total scan work sums to Θ(<strong>n²</strong>).",
        timeWorstWhy: "The number of comparisons doesn’t depend on input order: it always performs the same full scans, so worst case is Θ(<strong>n²</strong>).",
        space: "O(1)", type: "Brute Force",
        spaceWhy: "Only tracks indices and does swaps in-place; extra memory stays constant.",
        stability: "Unstable (usually)", inplace: "In-place",
        observation: "Look for how it scans through the entire unsorted region tracking the minimum, and then makes ONE yellow swap to place it exactly where it belongs.",
        usecase: "Useful when memory write (swap) operations are very costly, as it makes O(n) swaps.",
        prosCons: "Pros: Never makes more than O(n) swaps. Cons: Always scans everything remaining, making it rigidly O(n²).",
        creator: "Unknown", date: "Early computer science routines (1950s)"
    },
    insertion: {
        name: "Insertion Sort",
        desc: "Builds the final sorted array one item at a time. It takes one element from the input data, finds the location it belongs within the sorted list, and inserts it there.",
        codeSnippet: `def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i-1
        while j >= 0 and key < arr[j]:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr`,
        timeBest: "O(n)", timeAvg: "O(n²)", timeWorst: "O(n²)",
        timeBestWhy: "If the array is already sorted, the inner <code>while</code> fails immediately each time, so there’s ~1 comparison per element → Θ(<strong>n</strong>).",
        timeAvgWhy: "On average, each new element shifts past a chunk of the already-seen elements. Total shifts/comparisons across all insertions add up to Θ(<strong>n²</strong>).",
        timeWorstWhy: "Reverse-sorted input makes each insertion shift all the way left. Work per element becomes ≈ <strong>i</strong>, summing to Θ(<strong>n²</strong>).",
        space: "O(1)", type: "Decrease and Conquer",
        spaceWhy: "Uses a constant-size key variable and indices; no extra arrays are allocated.",
        stability: "Stable", inplace: "In-place",
        observation: "Notice the sorted region growing on the left. You will see a single element repeatedly swapped backwards into the green zone until it hits a smaller element.",
        usecase: "Used in real-world standard libraries (like Python's Timsort or C++'s std::sort) for small arrays (size < 16-64).",
        prosCons: "Pros: Highly efficient for small or nearly sorted arrays. Cons: Inefficient for large unsorted arrays.",
        creator: "John Mauchly / Various", date: "Reportedly 1946"
    },
    quick: {
        name: "Quick Sort",
        desc: "Selects a 'pivot' element and partitions the array into two sub-arrays, according to whether they are less than or greater than the pivot. The sub-arrays are then sorted recursively.",
        codeSnippet: `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)`,
        timeBest: "O(n log n)", timeAvg: "O(n log n)", timeWorst: "O(n²)",
        timeBestWhy: "Each partition step scans all <strong>n</strong> elements, and if the pivot splits roughly in half, there are about <strong>log n</strong> recursion levels → Θ(<strong>n log n</strong>).",
        timeAvgWhy: "With reasonably balanced pivots on average, total work is “scan n” across ~<strong>log n</strong> levels of recursion → Θ(<strong>n log n</strong>).",
        timeWorstWhy: "If the pivot repeatedly splits as (0, n−1) (highly unbalanced), recursion depth becomes Θ(<strong>n</strong>) and each level still scans Θ(<strong>n</strong>) → Θ(<strong>n²</strong>).",
        space: "O(log n)", type: "Divide and Conquer",
        spaceWhy: "The extra space mainly comes from recursion stack depth. With balanced splits it’s about <strong>log n</strong> stack frames.",
        stability: "Unstable", inplace: "In-place (mostly)",
        observation: "Watch the chaotic scattering across the array based on a pivot value, slowly consolidating into sorted chunks. The logic time here is usually incredibly fast.",
        usecase: "The default sorting algorithm in many systems and standard libraries (e.g. C's qsort, Java for primitives) due to excellent cache hit rates.",
        prosCons: "Pros: Very fast on average. Cons: Worst case O(n²) if poorly implemented with bad pivots, unstable.",
        creator: "Tony Hoare", date: "1959 (Published 1961)"
    },
    merge: {
        name: "Merge Sort",
        desc: "Divides the unsorted list into n sublists, each containing one element. Then repeatedly merges sublists to produce new sorted sublists until there is only one left.",
        codeSnippet: `def merge_sort(arr):
    if len(arr) <= 1: return arr
    mid = len(arr) // 2
    L = merge_sort(arr[:mid])
    R = merge_sort(arr[mid:])
    res = []
    while L and R:
        res.append(L.pop(0) if L[0] <= R[0] else R.pop(0))
    return res + L + R`,
        timeBest: "O(n log n)", timeAvg: "O(n log n)", timeWorst: "O(n log n)",
        timeBestWhy: "Splits the array in half until single elements (≈ <strong>log n</strong> levels). Each level merges total of <strong>n</strong> items → Θ(<strong>n log n</strong>).",
        timeAvgWhy: "Regardless of ordering, merging at each level processes all <strong>n</strong> elements, across ~<strong>log n</strong> levels → Θ(<strong>n log n</strong>).",
        timeWorstWhy: "Worst case is the same as average: merge work per level is Θ(<strong>n</strong>) and there are Θ(<strong>log n</strong>) levels → Θ(<strong>n log n</strong>).",
        space: "O(n)", type: "Divide and Conquer",
        spaceWhy: "Merging typically builds temporary arrays/lists to combine halves, requiring extra memory proportional to <strong>n</strong>.",
        stability: "Stable", inplace: "Out-of-place",
        observation: "The array will break down conceptually into tiny sorted chunks, and you'll see those chunks zip together in order.",
        usecase: "Standard generic sorting routine in languages like Python (Timsort uses it) and Java (for objects). Essential for external sorting (large data sets on disk).",
        prosCons: "Pros: Guaranteed O(n log n) and stable. Cons: Requires O(n) auxiliary memory.",
        creator: "John von Neumann", date: "1945"
    },
    heap: {
        name: "Heap Sort",
        desc: "Imagine a binary tree where every parent is bigger than its children (a max-heap). The algorithm builds this heap, then repeatedly swaps the largest element to the end of the array.",
        codeSnippet: `import heapq
def heap_sort(arr):
    heapq.heapify(arr)
    return [heapq.heappop(arr) for _ in range(len(arr))]`,
        timeBest: "O(n log n)", timeAvg: "O(n log n)", timeWorst: "O(n log n)",
        timeBestWhy: "Build heap, then extract max <strong>n</strong> times. Each extraction does a <strong>log n</strong> sift-down → Θ(<strong>n log n</strong>).",
        timeAvgWhy: "Average behavior is dominated by <strong>n</strong> heap extractions, each costing Θ(<strong>log n</strong>) → Θ(<strong>n log n</strong>).",
        timeWorstWhy: "Even in worst case, each heap operation is Θ(<strong>log n</strong>), repeated Θ(<strong>n</strong>) times → Θ(<strong>n log n</strong>).",
        space: "O(1)", type: "Selection Method",
        spaceWhy: "In the in-place version, the heap lives inside the same array; extra memory stays constant (ignoring recursion because none is needed).",
        stability: "Unstable", inplace: "In-place",
        observation: "First, you will see it establishing the 'max-heap' property (bringing large elements to the left). Then, it swaps the largest item to the right edge and sifts down the displaced element.",
        usecase: "Embedded systems or contexts with strict memory constraints that still require guaranteed O(n log n) worst-case time.",
        prosCons: "Pros: No auxiliary memory needed, optimal worst-case bounds. Cons: Constant factors are slower than Quick Sort; terrible cache locality.",
        creator: "J. W. J. Williams", date: "1964"
    },
    bogo: {
        name: "Bogo Sort",
        desc: "A highly ineffective sorting algorithm based on the generate and test paradigm. It successively generates permutations of its input until it finds one that is sorted.",
        codeSnippet: `import random
def bogo_sort(arr):
    while arr != sorted(arr):
        random.shuffle(arr)
    return arr`,
        timeBest: "O(n)", timeAvg: "O(n × n!)", timeWorst: "Unbounded (∞)",
        timeBestWhy: "If the input is already sorted, it just checks whether it’s sorted once, which takes Θ(<strong>n</strong>).",
        timeAvgWhy: "Expected shuffles before success is on the order of <strong>n!</strong> permutations, and each “is this sorted?” check costs Θ(<strong>n</strong>) → Θ(<strong>n × n!</strong>).",
        timeWorstWhy: "There is no upper bound on how many random shuffles could occur before hitting the sorted permutation (it can run forever).",
        space: "O(1)", type: "Las Vegas / Brute Force",
        spaceWhy: "Shuffles the same array in-place and only needs constant extra variables.",
        stability: "Unstable", inplace: "In-place",
        observation: "Wait and watch as the entire array flashes randomly into total chaos. It checks the entire array left to right; if un-sorted, it detonates and tries again randomly.",
        usecase: "Absolutely none, other than as an inside joke among computer scientists or to benchmark quantum computers (Quantum Bogo Sort).",
        prosCons: "Pros: Can theoretically finish on the very first try. Cons: Heat death of the universe may occur before 15 elements are sorted.",
        creator: "H. G. Baker (Humorous)", date: "Mentioned ~1986"
    },
    optbogo: {
        name: "Optimized Bogo Sort",
        desc: "A slightly less disastrous approach to Bogo sort. It shuffles only the part of the array that remains unsorted, preserving the elements that happened to land in the correct final positions.",
        codeSnippet: `import random
def optimized_bogo(arr):
    n = len(arr)
    while arr != sorted(arr):
        idx = next((i for i in range(n-1) if arr[i] > arr[i+1]), 0)
        sub = arr[idx:]
        random.shuffle(sub)
        arr[idx:] = sub
    return arr`,
        timeBest: "O(n)", timeAvg: "O(n!) (Slightly better)", timeWorst: "Unbounded (∞)",
        timeBestWhy: "If already sorted, it only performs the “is sorted?” check once → Θ(<strong>n</strong>).",
        timeAvgWhy: "It reduces the shuffled region when it gets lucky, but still relies on random permutations; expected time remains factorial-scale (≈ Θ(<strong>n!</strong>)).",
        timeWorstWhy: "Still has no guaranteed stopping time: the random process can (theoretically) avoid success forever.",
        space: "O(1)", type: "Las Vegas / Decrease",
        spaceWhy: "Only shuffles part of the array and uses constant extra variables; it doesn’t allocate a second full array.",
        stability: "Unstable", inplace: "In-place",
        observation: "Look for 'locked in' elements on the left side that survive the random shuffles. The chaos zone shrinks slightly whenever it randomly gets lucky.",
        usecase: "When you want to demonstrate optimizations on exceptionally bad ideas.",
        prosCons: "Pros: Astronomically faster than standard bogo sort. Cons: Still comically useless for actual sorting.",
        creator: "Internet Culture", date: "Unknown"
    },
    counting: {
        name: "Counting Sort",
        desc: "An integer sorting algorithm that operates by counting the number of objects that possess distinct key values, and calculating the position of each key in the output sequence.",
        codeSnippet: `def counting_sort(arr):
    max_val = max(arr)
    count = [0] * (max_val + 1)
    for num in arr: count[num] += 1
    for i in range(1, len(count)): count[i] += count[i-1]
    res = [0] * len(arr)
    for num in reversed(arr):
        res[count[num] - 1] = num
        count[num] -= 1
    return res`,
        timeBest: "O(n + k)", timeAvg: "O(n + k)", timeWorst: "O(n + k)",
        timeBestWhy: "Makes linear passes over the input (<strong>n</strong>) and over the value range array (<strong>k</strong>): count → prefix sums → output → Θ(<strong>n + k</strong>).",
        timeAvgWhy: "Runtime is driven by input size (<strong>n</strong>) plus the range of possible values (<strong>k</strong>), independent of initial ordering → Θ(<strong>n + k</strong>).",
        timeWorstWhy: "Worst case is still Θ(<strong>n + k</strong>) because it always performs those full passes (assuming max value range <strong>k</strong> is fixed by input).",
        space: "O(n + k)", type: "Non-Comparison / Distribution",
        spaceWhy: "Needs an output array of size <strong>n</strong> and a counting array of size <strong>k</strong> → Θ(<strong>n + k</strong>).",
        stability: "Stable", inplace: "Out-of-place",
        observation: "You won't see pair-by-pair swaps. Instead, it scans the entire array to count occurrences, then mathematically calculates exactly where each item belongs, dropping them into place.",
        usecase: "Highly efficient for sorting integers when the range between the minimum and maximum value (k) is not significantly larger than the number of items (n).",
        prosCons: "Pros: Incredible linear O(n) performance for small ranges. Cons: Uses lots of memory; cannot be easily used for floats or long strings.",
        creator: "Harold H. Seward", date: "1954"
    },
    radix: {
        name: "Radix Sort",
        desc: "A non-comparative integer sorting algorithm that sorts data with integer keys by grouping keys by individual digits which share the same significant position and value.",
        codeSnippet: `def radix_sort(arr):
    max_val = max(arr)
    exp = 1
    while max_val // exp > 0:
        counting_sort_by_digit(arr, exp)
        exp *= 10
    return arr`,
        timeBest: "O(nk)", timeAvg: "O(nk)", timeWorst: "O(nk)",
        timeBestWhy: "Processes the array once per digit/pass. If there are <strong>k</strong> digits and each pass is Θ(<strong>n</strong>), total is Θ(<strong>n k</strong>).",
        timeAvgWhy: "Each of the <strong>k</strong> digit passes performs a stable distribution/counting step over <strong>n</strong> items → Θ(<strong>n k</strong>).",
        timeWorstWhy: "Worst case still does all <strong>k</strong> passes across all <strong>n</strong> items → Θ(<strong>n k</strong>).",
        space: "O(n + k)", type: "Non-Comparison / Distribution",
        spaceWhy: "Typically uses a Counting-Sort-like buffer/output per pass (≈ <strong>n</strong>) plus buckets/counts (range-dependent), so extra space is about Θ(<strong>n + k</strong>) in this simplified model.",
        stability: "Stable", inplace: "Out-of-place",
        observation: "It sweeps through the array multiple times-first aligning elements by their ones digit, then their tens digit, and so on, progressively refining the order.",
        usecase: "Often used when O(n log n) is too slow and the data consists of integers or strings where the maximum number of digits (k) is small.",
        prosCons: "Pros: Linear time complexity if k is constant. Cons: Relies on an underlying stable sort (like Counting Sort) which takes extra memory.",
        creator: "Herman Hollerith", date: "1887"
    }
};

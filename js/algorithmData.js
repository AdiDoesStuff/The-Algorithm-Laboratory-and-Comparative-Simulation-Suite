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
        space: "O(1)", type: "Brute Force",
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
        space: "O(1)", type: "Brute Force",
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
        space: "O(1)", type: "Decrease and Conquer",
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
        space: "O(log n)", type: "Divide and Conquer",
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
        space: "O(n)", type: "Divide and Conquer",
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
        space: "O(1)", type: "Selection Method",
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
        space: "O(1)", type: "Las Vegas / Brute Force",
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
        space: "O(1)", type: "Las Vegas / Decrease",
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
        space: "O(n + k)", type: "Non-Comparison / Distribution",
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
        space: "O(n + k)", type: "Non-Comparison / Distribution",
        stability: "Stable", inplace: "Out-of-place",
        observation: "It sweeps through the array multiple times-first aligning elements by their ones digit, then their tens digit, and so on, progressively refining the order.",
        usecase: "Often used when O(n log n) is too slow and the data consists of integers or strings where the maximum number of digits (k) is small.",
        prosCons: "Pros: Linear time complexity if k is constant. Cons: Relies on an underlying stable sort (like Counting Sort) which takes extra memory.",
        creator: "Herman Hollerith", date: "1887"
    }
};

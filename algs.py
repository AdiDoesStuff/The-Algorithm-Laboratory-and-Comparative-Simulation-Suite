import random

def bubble_sort_steps(arr):
    steps = [] 
    n = len(arr)
    temp_arr = arr.copy()
    for i in range(n):
        for j in range(0, n-i-1):
            steps.append({'type' : 'compare' , 'indices' : [j , j+1], 'current_state' : temp_arr.copy()})
            if temp_arr[j] > temp_arr[j+1]:
                temp_arr[j], temp_arr[j+1] = temp_arr[j+1], temp_arr[j]
                steps.append({'type': 'swap', 'indices': [j, j+1], 'current_state': temp_arr.copy()})
    return steps

def selection_sort_steps(arr):
    steps = []
    n = len(arr)
    temp_arr = arr.copy()
    for i in range(n):
        min_idx = i
        for j in range(i+1, n):
            # Record comparison
            steps.append({'type': 'compare', 'indices': [min_idx, j], 'current_state': temp_arr.copy()})
            if temp_arr[j] < temp_arr[min_idx]:
                min_idx = j
        # Record swap
        temp_arr[i], temp_arr[min_idx] = temp_arr[min_idx], temp_arr[i]
        steps.append({'type': 'swap', 'indices': [i, min_idx], 'current_state': temp_arr.copy()})
    return steps


def quick_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()

    def partition(low, high):
        pivot = temp_arr[high]
        i = low - 1
        for j in range(low, high):
            # Record Comparison with Pivot
            steps.append({'type': 'compare', 'indices': [j, high], 'current_state': temp_arr.copy()})
            if temp_arr[j] <= pivot:
                i += 1
                temp_arr[i], temp_arr[j] = temp_arr[j], temp_arr[i]
                # Record Swap
                steps.append({'type': 'swap', 'indices': [i, j], 'current_state': temp_arr.copy()})
        
        temp_arr[i+1], temp_arr[high] = temp_arr[high], temp_arr[i+1]
        steps.append({'type': 'swap', 'indices': [i+1, high], 'current_state': temp_arr.copy()})
        return i + 1

    def quick_sort(low, high):
        if low < high:
            pi = partition(low, high)
            quick_sort(low, pi - 1)
            quick_sort(pi + 1, high)

    quick_sort(0, len(temp_arr) - 1)
    return steps


def insertion_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    for i in range(1,len(arr)):
        com = temp_arr[i]
        j = i - 1
        steps.append({'type': 'compare', 'indices': [j, i], 'current_state': temp_arr.copy()})
        while j >= 0 and com < temp_arr[j]:
            steps.append({'type': 'compare', 'indices': [j, j + 1], 'current_state': temp_arr.copy()})
            temp_arr [j + 1] = temp_arr[j]
            steps.append({'type': 'swap', 'indices': [j, j + 1], 'current_state': temp_arr.copy()})
            j -= 1
        temp_arr[j + 1] = com
        steps.append({'type': 'swap', 'indices': [j + 1, j + 1], 'current_state': temp_arr.copy()})

    return steps


def merge_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()

    def mergesort(start,end):
        if (end - start) <= 1:
            return temp_arr[start:end]
        
        mid = (start + end) // 2
        left = mergesort(start,mid)
        right = mergesort(mid,end)
        
        return merge(left,right,start,end)
    
    def merge(l,r,start,end):
        merged = []
        i = j = 0
        while i < len(l) and j < len(r):
            steps.append({'type': 'compare', 'indices': [start + i, mid + j], 'current_state': temp_arr.copy()})
            if l[i] <= r[j]:
                merged.append(l[i])
                i += 1
            else:
                merged.append(r[j])
                j += 1
        
        while i < len(l):
            merged.append(l[i])
            i += 1
        
        while j < len(r):
            merged.append(r[j])
            j += 1
        
        for k in range(len(merged)):
            temp_arr[start + k] = merged[k]
            steps.append({'type': 'swap', 'indices': [start + k, start + k], 'current_state': temp_arr.copy()})
        
        return merged
    mergesort(0, len(temp_arr))
    return steps


def heap_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    n = len(temp_arr)

    def heapify(n, i):
        largest = i
        left = 2 * i + 1
        right = 2 * i + 2

        # Record Comparison: Root vs Left Child
        if left < n:
            steps.append({'type': 'compare', 'indices': [largest, left], 'current_state': temp_arr.copy()})
            if temp_arr[left] > temp_arr[largest]:
                largest = left

        # Record Comparison: Largest vs Right Child
        if right < n:
            steps.append({'type': 'compare', 'indices': [largest, right], 'current_state': temp_arr.copy()})
            if temp_arr[right] > temp_arr[largest]:
                largest = right

        # If root is not largest, swap and keep heapifying
        if largest != i:
            temp_arr[i], temp_arr[largest] = temp_arr[largest], temp_arr[i]
            # Record Swap
            steps.append({'type': 'swap', 'indices': [i, largest], 'current_state': temp_arr.copy()})
            
            # Recursively heapify the affected sub-tree
            heapify(n, largest)

    # 1. Build a maxheap.
    for i in range(n // 2 - 1, -1, -1):
        heapify(n, i)

    # 2. One by one extract elements
    for i in range(n - 1, 0, -1):
        # Move current root to end (largest element to sorted position)
        temp_arr[i], temp_arr[0] = temp_arr[0], temp_arr[i]
        steps.append({'type': 'swap', 'indices': [0, i], 'current_state': temp_arr.copy()})
        
        # Call max heapify on the reduced heap
        heapify(i, 0)

    return steps

def bogo_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    n = len(temp_arr)

    def isSorted(now):
        for i in range(len(now) - 1):
            steps.append({'type': 'compare', 'indices': [i, i+1], 'current_state': now.copy()})
            if not now[i] < now[i+1]:
                break
        else:
            return True
        return False
    
    while not is_sorted(temp_arr):
        random.shuffle(temp_arr)
        # Record the shuffle as a giant "swap" of all indices
        steps.append({'type': 'swap', 'indices': list(range(n)), 'current_state': temp_arr.copy()})
        
        # because it generates MILLIONS of steps. 
        if len(steps) > 5000: 
            break
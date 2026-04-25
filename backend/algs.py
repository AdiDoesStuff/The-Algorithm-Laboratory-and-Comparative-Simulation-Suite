import random
import time

def bubble_sort_steps(arr):
    steps = [] 
    n = len(arr)
    temp_arr = arr.copy()
    start_time = time.perf_counter()
    
    for i in range(n):
        for j in range(0, n-i-1):
            steps.append({'type' : 'compare' , 'indices' : [j , j+1], 'current_state' : temp_arr.copy()})
            if temp_arr[j] > temp_arr[j+1]:
                temp_arr[j], temp_arr[j+1] = temp_arr[j+1], temp_arr[j]
                steps.append({'type': 'swap', 'indices': [j, j+1], 'current_state': temp_arr.copy()})
    
    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time}

def selection_sort_steps(arr):
    steps = []
    n = len(arr)
    temp_arr = arr.copy()
    start_time = time.perf_counter()
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
    
    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time}

def quick_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    start_time = time.perf_counter()
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

    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time}

def insertion_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    start_time = time.perf_counter()
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

    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time}

def merge_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    start_time = time.perf_counter()

    def mergesort(start,end):
        if (end - start) <= 1:
            return temp_arr[start:end]
        
        mid = (start + end) // 2
        left = mergesort(start,mid)
        right = mergesort(mid,end)
        
        return merge(left,right,start,mid,end)
    
    def merge(l,r,start,mid,end):
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
    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time}

def heap_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    n = len(temp_arr)
    start_time = time.perf_counter()

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

    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time}

def bogo_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    n = len(temp_arr)
    start_time = time.perf_counter()

    def isSorted(now):
        for i in range(len(now) - 1):
            steps.append({'type': 'compare', 'indices': [i, i+1], 'current_state': now.copy()})
            if not now[i] <= now[i+1]:
                break
        else:
            return True
        return False
    
    truncated = False
    while not isSorted(temp_arr):
        random.shuffle(temp_arr)
        # Record the shuffle as a giant "swap" of all indices
        steps.append({'type': 'swap', 'indices': list(range(n)), 'current_state': temp_arr.copy()})
        
        # Cap at 5000 steps to prevent browser lockup
        if len(steps) > 5000:
            truncated = True
            break
    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time, "truncated": truncated}

def optimized_bogo_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    n = len(temp_arr)
    start = 0
    start_time = time.perf_counter()

    def isSorted(now):
        nonlocal start
        # IMPORTANT: We always start checking from 0 to ensure 
        # the shuffle didn't break previous order
        for i in range(len(now) - 1):
            steps.append({'type': 'compare', 'indices': [i, i+1], 'current_state': now.copy()})
            if now[i] <= now[i+1]:
                # If these two are fine, we might be able to 'lock' more
                if i >= start:
                    start = i + 1
            else:
                # ORDER BROKEN! We found where the mess starts
                start = i
                return False
        return True
    
    truncated = False
    while not isSorted(temp_arr):
        # We only shuffle the part that is NOT sorted yet
        to_shuffle = temp_arr[start:] 
        random.shuffle(to_shuffle)
        temp_arr[start:] = to_shuffle
        
        # Highlight the bars that just got scrambled
        steps.append({
            'type': 'swap', 
            'indices': list(range(start, n)), 
            'current_state': temp_arr.copy()
        })
        
        # Cap at 5000 steps to prevent browser lockup
        if len(steps) > 5000:
            truncated = True
            break
            
    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time, "truncated": truncated}

def counting_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    n = len(temp_arr)
    start_time = time.perf_counter()
    
    if n == 0:
        return {"steps": steps, "execution_time": 0}

    max_val = max(temp_arr)
    count = [0] * (max_val + 1)
    output = [0] * n
    
    # Store the count of each element
    for i in range(n):
        count[temp_arr[i]] += 1
        steps.append({'type': 'compare', 'indices': [i], 'current_state': temp_arr.copy()})
        
    for i in range(1, max_val + 1):
        count[i] += count[i - 1]
        
    # Build the output array
    for i in range(n - 1, -1, -1):
        output[count[temp_arr[i]] - 1] = temp_arr[i]
        count[temp_arr[i]] -= 1
        
    # Copy output back to temp_arr for visualization updates
    for i in range(n):
        temp_arr[i] = output[i]
        steps.append({'type': 'swap', 'indices': [i, i], 'current_state': temp_arr.copy()})

    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time}

def counting_sort_for_radix(temp_arr, exp, steps):
    n = len(temp_arr)
    output = [0] * n
    count = [0] * 10
    
    # Store count of occurrences in count[]
    for i in range(n):
        index = temp_arr[i] // exp
        count[index % 10] += 1
        steps.append({'type': 'compare', 'indices': [i], 'current_state': temp_arr.copy()})
        
    # Change count[i] so that count[i] now contains actual position of this digit in output[]
    for i in range(1, 10):
        count[i] += count[i - 1]
        
    # Build the output array
    for i in range(n - 1, -1, -1):
        index = temp_arr[i] // exp
        output[count[index % 10] - 1] = temp_arr[i]
        count[index % 10] -= 1
        
    # Copy the output array to temp_arr[], so that temp_arr[] now contains sorted numbers according to current digit
    for i in range(n):
        temp_arr[i] = output[i]
        steps.append({'type': 'swap', 'indices': [i, i], 'current_state': temp_arr.copy()})

def radix_sort_steps(arr):
    steps = []
    temp_arr = arr.copy()
    n = len(temp_arr)
    start_time = time.perf_counter()
    
    if n > 0:
        max_val = max(temp_arr)
        exp = 1
        while max_val // exp > 0:
            counting_sort_for_radix(temp_arr, exp, steps)
            exp *= 10
            
    end_time = time.perf_counter()
    execution_time = (end_time - start_time) * 1000
    return {"steps": steps, "execution_time": execution_time}
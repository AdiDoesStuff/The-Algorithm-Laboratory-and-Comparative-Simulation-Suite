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

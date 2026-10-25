async function fetchSortSteps(algorithm, array) {
    try {
        const response = await fetch(`${BASE_URL}/sort`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algorithm, array })
        });
        if (!response.ok) {
            throw new Error(`Server error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Backend error:", error);
        alert("Is your Python server running? Check the terminal!");
    }
}

async function fetchTreeSteps(algorithm, payload) {
    try {
        const response = await fetch(`${BASE_URL}/tree`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algorithm, ...payload })
        });
        if (!response.ok) {
            throw new Error(`Server error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Tree backend error:", error);
    }
}

async function fetchHashSteps(method, keys, tableSize) {
    try {
        const response = await fetch(`${BASE_URL}/hash`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, keys, tableSize })
        });
        if (!response.ok) {
            throw new Error(`Server error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Hash backend error:", error);
    }
}

async function fetchDPSteps(problem, params) {
    try {
        const response = await fetch(`${BASE_URL}/dp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ problem, params })
        });
        if (!response.ok) {
            throw new Error(`Server error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("DP backend error:", error);
    }
}

async function fetchBenchmarkData(algorithms, sizes) {
    try {
        const response = await fetch(`${BASE_URL}/bench`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algorithms, sizes })
        });
        if (!response.ok) {
            throw new Error(`Server error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Benchmark backend error:", error);
    }
}


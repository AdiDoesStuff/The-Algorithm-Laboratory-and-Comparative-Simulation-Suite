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

/**
 * Sequence guard helper: returns a function that wraps a promise (or promise factory)
 * and resolves to null if a newer call has started since.
 */
function createLatest() {
    let latestId = 0;
    return function (promiseFactory) {
        const thisId = ++latestId;
        const promise = (typeof promiseFactory === 'function') ? promiseFactory() : promiseFactory;
        return promise.then(result => {
            if (thisId !== latestId) return null;
            return result;
        }).catch(err => {
            if (thisId !== latestId) return null;
            throw err;
        });
    };
}

async function fetchTreeSteps(algorithm, payload) {
    const baseUrl = (typeof BASE_URL !== 'undefined') ? BASE_URL : ((typeof window !== 'undefined' && window.BASE_URL) ? window.BASE_URL : 'http://127.0.0.1:5000');
    try {
        const response = await fetch(`${baseUrl}/tree`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algorithm, ...payload })
        });
        const contentType = response.headers.get('content-type') || '';
        let json = null;
        if (contentType.includes('application/json')) {
            json = await response.json().catch(() => null);
        }
        if (!response.ok) {
            return {
                ok: false,
                data: null,
                error: {
                    message: json?.error || response.statusText || `HTTP ${response.status}`,
                    field: json?.field || 'request'
                }
            };
        }
        return {
            ok: true,
            data: json,
            error: null
        };
    } catch (error) {
        return {
            ok: false,
            data: null,
            error: {
                message: error?.message || "Failed to connect to Python server",
                field: "network"
            }
        };
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


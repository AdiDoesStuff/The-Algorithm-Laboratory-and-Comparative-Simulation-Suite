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

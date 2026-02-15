
import fetch, { Headers } from 'node-fetch';

async function testFetch() {
    try {
        const response = await fetch('http://localhost:3000/api/v1/me', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text}`);

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testFetch();

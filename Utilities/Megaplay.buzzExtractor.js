/**
 * Extracts a Megaplay.buzz stream URL from the given embed URL and referer.
 * @param {string} embed - The Megaplay.buzz embed URL.
 * @param {string} referer - The referer URL for the request.
 * @returns {Promise<string>} A promise that resolves with the stream URL if extraction is successful, otherwise null and an error is logged.
 */
async function extractMegaplayBuzz(embed, referer) {
    const REGEX = /<title>File ([0-9]+)/;

    try {
        const response = await fetch(embed, {
            headers: {
                "Referer": referer
            }
        });
        const html = typeof response === 'object' ? await response.text() : await response;

        if(!html || html.length <= 0) {
            throw new Error('No HTML response received');
        }

        const match = html.match(REGEX);

        if(!match || match.length < 2) {
            throw new Error('No stream ID found in the HTML response');
        }

        const streamId = match[1];
        const streamResponse = await fetch(`https://megaplay.buzz/stream/getSources?id=${streamId}&id=${streamId}`, {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
            }
        });
        const streamData = typeof streamResponse === 'object' ? await streamResponse.text() : await streamResponse;

        if(!streamData) {
            throw new Error('No stream data found');
        }

        return streamData;

    } catch (error) {
        console.error('Error extracting MegaplayBuzz stream URL:' + error.message);
        return null;
    }
}
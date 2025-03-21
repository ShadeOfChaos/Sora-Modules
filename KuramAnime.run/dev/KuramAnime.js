//***** LOCAL TESTING
// const results = await searchResults();
// const details = await extractDetails();
// const episodes = await extractEpisodes();
// const streamUrl = await extractStreamUrl();
// console.log('STREAMURL:', streamUrl);
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    return JSON.stringify([{ title: 'Test show', image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/ofchaos.jpg', href: '#' }]);
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    const details = {
        description: 'Test show',
        aliases: '',
        airdate: ''
    }

    return JSON.stringify([details]);
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    return JSON.stringify([{
        href: '#',
        number: 1
    }]);
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    try {
        // const response = await fetch(url);
        // const html = typeof response === 'object' ? await response.text() : await response;

        // Fetch the stream url from within html and return it through streamUrl

        return atob('aHR0cHM6Ly9tdXRzdW1pLm15LmlkL2tkcml2ZS8wQm0ybHNVY1pzZi9LdXJhbWFuaW1lLVNPTE9MVkxfQkQtMDEtNzIwcC1LdXJhbWFCRC5tcDQ/Z2lkPTFXWVdXeHBUZHlZQW9tSko1cThhaGtRMmxvWEZfYUhtdCZpZD02NzE2MzM2NjY5MDEtMzB1OWpnMW51NWNtY2NzZDljMHBnaXJscnNrZmI5YnQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20mc2M9R09DU1BYLURzaUR0UDVMcTlFNzUyOUlIaXVWVDFyRHY1Y0gmcnQ9MS8vMDNLR1lyVnZhWG52YkNnWUlBUkFBR0FNU053Ri1MOUlyREVIaUtOOXBTRXJ6NXkydE9BX0wtV0NrLS1rWFg4WHZ5bDNoWWNkaVFjLTdyQ1RJT0tLUGJDXzNOeUpMY25wdGl4RSZjY2U9MQ==');

    } catch(e) {
        console.log('Error:', e);
        return null;
    }
}

function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (str.length % 4 == 1) {
        throw new Error("atob failed: The input is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
            ? output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
            : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}
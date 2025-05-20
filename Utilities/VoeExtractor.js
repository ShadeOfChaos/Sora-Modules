// Run voeExtractor(result_of_fetch().text())

/**
 * Extracts a JSON object from the given source page by finding the
 * encoded string marked with the regex /MKGMa="([\s\S]+?)"/ and
 * decoding it using the voeDecoder function.
 * @param {string} sourcePageHtml - The source page to be parsed.
 * @returns {object|null} The extracted JSON object if successful,
 *   otherwise null.
 */
function voeExtractor(sourcePageHtml) {
    const REGEX = /MKGMa="([\s\S]+?)"/;

    const match = sourcePageHtml.match(REGEX);
    if(match == null || match[1] == null) {
        console.log('Could not extract from Voe source');
        return null;
    }

    const encodedString = match[1];
    const decodedJson = voeDecoder(encodedString);
    
    return decodedJson;
}

/**
 * Decodes the given MKGMa string, which is a custom encoded string used
 * by VOE. This function applies the following steps to the input string to
 * decode it:
 * 1. Apply ROT13 to each alphabetical character in the string.
 * 2. Remove all underscores from the string.
 * 3. Decode the string using the Base64 algorithm.
 * 4. Apply a character shift of 0x3 to each character in the decoded string.
 * 5. Reverse the order of the characters in the shifted string.
 * 6. Decode the reversed string using the Base64 algorithm again.
 * 7. Parse the decoded string as JSON.
 * @param {string} MKGMa_String - The input string to be decoded.
 * @returns {object} The decoded JSON object.
 */
function voeDecoder(MKGMa_String) {
    let ROT13String = ROT13(MKGMa_String);
    let sanitizedString = voeSanitizer(ROT13String);
    let UnderscoreRemoved = sanitizedString.split('_').join('');
    let base64DecodedString = atob(UnderscoreRemoved);
    let charShiftedString = shiftCharacter(base64DecodedString, 0x3);
    let reversedString = charShiftedString.split('').reverse().join('');
    let base64DecodedStringAgain = atob(reversedString);
    let decodedJson;
    try {
        decodedJson = JSON.parse(base64DecodedStringAgain);
    } catch (error) {
        console.log('JSON parse error: ' + error.message);
        decodedJson = {};
    }
    return decodedJson;
}

/**
 * Encodes a given string using the ROT13 cipher, which shifts each letter
 * 13 places forward in the alphabet. Only alphabetical characters are 
 * transformed; other characters remain unchanged.
 * 
 * @param {string} string - The input string to be encoded.
 * @returns {string} The encoded string with ROT13 applied.
 */
function ROT13(string) {
    let ROT13String = '';

    for (let i=0; i < string.length; i++) {
        let currentCharCode = string.charCodeAt(i);

        // Check for uppercase
        if (currentCharCode >= 65 && currentCharCode <= 90) {
            currentCharCode = (currentCharCode - 65 + 13) % 26 + 65;
        // Check for lowercase
        } else if (currentCharCode >= 97 && currentCharCode <= 122) {
            currentCharCode = (currentCharCode - 97 + 13) % 26 + 97;
        }

        ROT13String += String.fromCharCode(currentCharCode);
    }

    return ROT13String;
}

/**
 * Sanitizes a given string by replacing all occurrences of certain "trash" strings
 * with an underscore. The trash strings are '@$', '^^', '~@', '%?', '*~', '!!', '#&'.
 * This is used to decode VOE encoded strings.
 * @param {string} string The string to be sanitized.
 * @returns {string} The sanitized string.
 */
function voeSanitizer(string) {
    let sanitizationArray = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
    let tempString = string;

    for (let i=0; i < sanitizationArray.length; i++) {
        let currentTrash = sanitizationArray[i];
        let sanitizedString = new RegExp(currentTrash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), 'g');

        tempString = tempString.replace(sanitizedString, '_');
    }

    return tempString;
}

/**
 * Shifts the characters in a string by a given number of places.
 * @param {string} string - The string to shift.
 * @param {number} shiftNum - The number of places to shift the string.
 * @returns {string} The shifted string.
 */
function shiftCharacter(string, shiftNum) {
    let tempArray = [];

    for (let i=0; i < string.length; i++) {
        tempArray.push(String.fromCharCode(string.charCodeAt(i) - shiftNum));
    }
    
    return tempArray.join('');
}
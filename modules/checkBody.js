// Function to validate that required fields exist and are not empty in request body
function checkBody(body, keys) {
  let isValid = true;

  for (const field of keys) {
    if (!body[field] || body[field] === "") {
      isValid = false;
    }
  }
  return isValid;
}

module.exports = { checkBody };

/**
 * Utility for vector calculations.
 * Used for semantic duplicate detection of 384-D text embeddings (MiniLM).
 */

/**
 * Calculates the Cosine Similarity between two numerical vectors.
 * 
 * Formula:
 *   sim(A, B) = (A • B) / (||A|| * ||B||)
 * 
 * @param {number[]} vecA - First vector (e.g. 384 floats)
 * @param {number[]} vecB - Second vector (e.g. 384 floats)
 * @returns {number} Cosine similarity score between -1.0 and 1.0
 */
function getCosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
    throw new TypeError('Both arguments to getCosineSimilarity must be arrays of numbers.');
  }

  const len = vecA.length;
  if (len === 0 || len !== vecB.length) {
    return 0;
  }

  let dotProduct = 0.0;
  let normASq = 0.0;
  let normBSq = 0.0;

  // Single-pass memory-efficient loop over floats
  for (let i = 0; i < len; i++) {
    const a = vecA[i];
    const b = vecB[i];

    dotProduct += a * b;
    normASq += a * a;
    normBSq += b * b;
  }

  const denominator = Math.sqrt(normASq) * Math.sqrt(normBSq);

  if (denominator === 0.0) {
    return 0.0;
  }

  const similarity = dotProduct / denominator;

  // Clamp floating point rounding anomalies to [-1.0, 1.0]
  if (similarity > 1.0) return 1.0;
  if (similarity < -1.0) return -1.0;

  return similarity;
}

module.exports = {
  getCosineSimilarity,
};

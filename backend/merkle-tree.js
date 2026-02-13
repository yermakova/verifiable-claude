const crypto = require('crypto');

/**
 * Merkle Tree implementation for fraud proofs
 * Allows us to commit to reasoning steps and later prove specific steps are invalid
 */
class MerkleTree {
  constructor(leaves) {
    this.leaves = leaves.map(leaf => this.hash(leaf));
    this.tree = this.buildTree(this.leaves);
    this.root = this.tree[this.tree.length - 1][0];
  }

  /**
   * Hash function (SHA-256)
   */
  hash(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Build the Merkle tree from leaves
   */
  buildTree(leaves) {
    if (leaves.length === 0) return [[]];

    const tree = [leaves];
    let currentLevel = leaves;

    while (currentLevel.length > 1) {
      const nextLevel = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const parent = this.hash(left + right);
        nextLevel.push(parent);
      }

      tree.push(nextLevel);
      currentLevel = nextLevel;
    }

    return tree;
  }

  /**
   * Get Merkle root (commitment)
   */
  getRoot() {
    return this.root;
  }

  /**
   * Generate Merkle proof for a specific leaf index
   * This proof allows anyone to verify that a specific claim was in the original commitment
   */
  getProof(index) {
    if (index >= this.leaves.length) {
      throw new Error('Leaf index out of bounds');
    }

    const proof = [];
    let currentIndex = index;
    let currentLevel = 0;

    while (currentLevel < this.tree.length - 1) {
      const levelNodes = this.tree[currentLevel];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < levelNodes.length) {
        proof.push({
          hash: levelNodes[siblingIndex],
          position: isRightNode ? 'left' : 'right'
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
      currentLevel++;
    }

    return proof;
  }

  /**
   * Verify a Merkle proof
   * Returns true if the leaf is part of the tree with the given root
   */
  static verifyProof(leafHash, proof, root) {
    let currentHash = leafHash;

    for (const step of proof) {
      const combined = step.position === 'left'
        ? step.hash + currentHash
        : currentHash + step.hash;

      currentHash = crypto.createHash('sha256').update(combined).digest('hex');
    }

    return currentHash === root;
  }

  /**
   * Get leaf hash at index
   */
  getLeafHash(index) {
    return this.leaves[index];
  }
}

module.exports = MerkleTree;

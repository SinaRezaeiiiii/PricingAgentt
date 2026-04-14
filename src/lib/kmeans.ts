// K-Means Clustering Implementation
// Implements K-Means algorithm with Min-Max normalization

export interface KMeansPoint {
  features: number[]; // [Landed Cost, Margin %, Net Qty]
  originalIndex: number;
  clusterId?: number;
}

export interface KMeansResult {
  clusters: number[]; // Array of cluster IDs for each point
  centroids: number[][]; // Final centroid positions
  iterations: number;
}

/**
 * Normalize features using Min-Max scaling to [0, 1]
 */
export function normalizeFeatures(points: KMeansPoint[]): {
  normalized: KMeansPoint[];
  min: number[];
  max: number[];
} {
  if (points.length === 0) {
    return { normalized: [], min: [], max: [] };
  }

  const numFeatures = points[0].features.length;
  const min: number[] = new Array(numFeatures).fill(Infinity);
  const max: number[] = new Array(numFeatures).fill(-Infinity);

  // Find min and max for each feature
  points.forEach(point => {
    point.features.forEach((value, i) => {
      if (!Number.isFinite(value)) {
        return;
      }
      if (value < min[i]) min[i] = value;
      if (value > max[i]) max[i] = value;
    });
  });

  for (let i = 0; i < numFeatures; i++) {
    if (!Number.isFinite(min[i]) || !Number.isFinite(max[i])) {
      min[i] = 0;
      max[i] = 0;
    }
  }

  // Normalize each point
  const normalized = points.map(point => ({
    ...point,
    features: point.features.map((value, i) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      const range = max[i] - min[i];
      if (!Number.isFinite(range) || range === 0) {
        return 0;
      }
      const normalizedValue = (value - min[i]) / range;
      return Number.isFinite(normalizedValue) ? normalizedValue : 0;
    }),
  }));

  return { normalized, min, max };
}

/**
 * Calculate Euclidean distance between two points
 */
function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(
    a.reduce((sum, val, i) => {
      const left = Number.isFinite(val) ? val : 0;
      const right = Number.isFinite(b[i]) ? b[i] : 0;
      return sum + Math.pow(left - right, 2);
    }, 0)
  );
}

/**
 * Initialize centroids using K-Means++ algorithm for better initial placement
 */
function initializeCentroids(points: KMeansPoint[], k: number): number[][] {
  if (points.length === 0) return [];
  
  const centroids: number[][] = [];
  
  // Choose first centroid randomly
  const firstIndex = Math.floor(Math.random() * points.length);
  centroids.push([...points[firstIndex].features]);
  
  // Choose remaining centroids with probability proportional to distance
  for (let i = 1; i < k; i++) {
    const distances = points.map(point => {
      const minDist = Math.min(
        ...centroids.map(centroid => euclideanDistance(point.features, centroid))
      );
      return minDist * minDist; // Squared distance
    });
    
    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let random = Math.random() * totalDist;
    
    for (let j = 0; j < points.length; j++) {
      random -= distances[j];
      if (random <= 0) {
        centroids.push([...points[j].features]);
        break;
      }
    }
  }
  
  return centroids;
}

/**
 * Assign each point to the nearest centroid
 */
function assignClusters(points: KMeansPoint[], centroids: number[][]): void {
  points.forEach(point => {
    let minDist = Infinity;
    let closestCluster = 0;
    
    centroids.forEach((centroid, i) => {
      const dist = euclideanDistance(point.features, centroid);
      if (dist < minDist) {
        minDist = dist;
        closestCluster = i;
      }
    });
    
    point.clusterId = closestCluster;
  });
}

/**
 * Update centroids based on current cluster assignments
 */
function updateCentroids(points: KMeansPoint[], centroids: number[][], k: number): number[][] {
  const numFeatures = points[0].features.length;
  const nextCentroids: number[][] = Array(k)
    .fill(null)
    .map(() => new Array(numFeatures).fill(0));
  const counts = new Array(k).fill(0);
  
  // Sum up all points in each cluster
  points.forEach(point => {
    const cluster = point.clusterId!;
    counts[cluster]++;
    point.features.forEach((value, i) => {
      nextCentroids[cluster][i] += value;
    });
  });
  
  // Calculate averages for non-empty clusters
  nextCentroids.forEach((centroid, i) => {
    if (counts[i] > 0) {
      centroid.forEach((_, j) => {
        nextCentroids[i][j] /= counts[i];
      });
    }
  });

  // Handle empty clusters by reseeding centroid to the point with the largest
  // reconstruction error (most dissimilar to its assigned centroid).
  for (let clusterId = 0; clusterId < k; clusterId++) {
    if (counts[clusterId] > 0) {
      continue;
    }

    let fallbackPointIndex = -1;
    let maxDistance = -1;
    points.forEach((point, index) => {
      const assignedCluster = point.clusterId ?? 0;
      const assignedCentroid = centroids[assignedCluster] ?? centroids[0];
      const dist = euclideanDistance(point.features, assignedCentroid);
      if (dist > maxDistance) {
        maxDistance = dist;
        fallbackPointIndex = index;
      }
    });

    if (fallbackPointIndex >= 0) {
      nextCentroids[clusterId] = [...points[fallbackPointIndex].features];
    } else {
      nextCentroids[clusterId] = [...centroids[clusterId]];
    }
  }
  
  return nextCentroids;
}

function calculateInertia(points: KMeansPoint[], centroids: number[][]): number {
  return points.reduce((sum, point) => {
    const clusterId = point.clusterId ?? 0;
    const centroid = centroids[clusterId] ?? centroids[0];
    const dist = euclideanDistance(point.features, centroid);
    return sum + dist * dist;
  }, 0);
}

/**
 * Check if centroids have converged (stopped moving)
 */
function hasConverged(oldCentroids: number[][], newCentroids: number[][], tolerance = 1e-6): boolean {
  for (let i = 0; i < oldCentroids.length; i++) {
    const dist = euclideanDistance(oldCentroids[i], newCentroids[i]);
    if (dist > tolerance) return false;
  }
  return true;
}

/**
 * Run K-Means clustering algorithm
 * @param points Array of points with features
 * @param k Number of clusters
 * @param maxIterations Maximum iterations to prevent infinite loops
 * @returns Clustering result with cluster assignments and centroids
 */
export function kMeans(
  points: KMeansPoint[],
  k: number,
  maxIterations = 100
): KMeansResult {
  if (points.length === 0 || k <= 0 || k > points.length) {
    return {
      clusters: [],
      centroids: [],
      iterations: 0,
    };
  }
  
  // Normalize the data
  const { normalized } = normalizeFeatures(points);

  const restartCount = Math.min(5, Math.max(2, k));
  let bestClusters: number[] = [];
  let bestCentroids: number[][] = [];
  let bestIterations = 0;
  let bestInertia = Infinity;

  for (let restart = 0; restart < restartCount; restart++) {
    let centroids = initializeCentroids(normalized, k);
    let iterations = 0;

    for (iterations = 0; iterations < maxIterations; iterations++) {
      assignClusters(normalized, centroids);
      const newCentroids = updateCentroids(normalized, centroids, k);

      if (hasConverged(centroids, newCentroids)) {
        centroids = newCentroids;
        break;
      }

      centroids = newCentroids;
    }

    assignClusters(normalized, centroids);
    const inertia = calculateInertia(normalized, centroids);

    if (inertia < bestInertia) {
      bestInertia = inertia;
      bestCentroids = centroids.map((centroid) => [...centroid]);
      bestClusters = normalized.map((point) => point.clusterId ?? 0);
      bestIterations = iterations + 1;
    }
  }
  
  return {
    clusters: bestClusters,
    centroids: bestCentroids,
    iterations: bestIterations,
  };
}

/**
 * Prepare data for K-Means clustering from part data
 * Extracts: Landed Cost (log), Margin %, Net Qty (log)
 * Parts with Landed Cost <= 0 are filtered out
 */
export function prepareClusteringData(parts: any[]): KMeansPoint[] {
  return parts
    .map((part, index) => {
      // Extract features with sanitization
      const landedCostRaw = Number(part["Landed Cost"]);
      const marginPercentRaw = Number(part["Margin %"]);
      const netQtyRaw = Number(part["Net Part Purchase Quantity"]);

      let landedCost = Number.isFinite(landedCostRaw) ? landedCostRaw : 0;
      let marginPercent = Number.isFinite(marginPercentRaw) ? marginPercentRaw : 0;
      let netQty = Number.isFinite(netQtyRaw) ? netQtyRaw : 0;
      
      // Convert margin to decimal if it's in percentage form (> 1)
      if (marginPercent > 1) {
        marginPercent = marginPercent / 100;
      }
      
      // Filter out parts with no cost (unrealistic for analysis)
      if (landedCost <= 0) {
        return null;
      }

      // Prevent invalid logarithms for negative quantities.
      // Net quantity can be negative (returns); clamp to 0 for clustering stability.
      netQty = Math.max(0, netQty);
      
      // Apply logarithmic transformation to handle wide value ranges
      // log(x + 1) to handle zero values gracefully
      const logCost = Math.log(landedCost + 1);
      const logQty = Math.log(netQty + 1);

      if (!Number.isFinite(logCost) || !Number.isFinite(marginPercent) || !Number.isFinite(logQty)) {
        return null;
      }
      
      return {
        features: [logCost, marginPercent, logQty],
        originalIndex: index,
      };
    })
    .filter((point): point is KMeansPoint => point !== null);
}

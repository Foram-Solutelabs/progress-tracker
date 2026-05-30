const MATCH_THRESHOLD = 0.6

export function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0))
}

export function findMatch(
  descriptor: number[],
  users: { id: string; faceDescriptor: number[] }[]
): string | null {
  let bestId: string | null = null
  let bestDistance = Infinity

  for (const user of users) {
    const distance = euclideanDistance(descriptor, user.faceDescriptor)
    if (distance < MATCH_THRESHOLD && distance < bestDistance) {
      bestDistance = distance
      bestId = user.id
    }
  }

  return bestId
}

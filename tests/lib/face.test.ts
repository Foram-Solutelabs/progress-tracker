import { euclideanDistance, findMatch } from '@/lib/face'

const makeDescriptor = (base: number, length = 128) =>
  Array.from({ length }, (_, i) => base + i * 0.001)

describe('euclideanDistance', () => {
  test('returns 0 for identical descriptors', () => {
    const a = makeDescriptor(0)
    expect(euclideanDistance(a, a)).toBeCloseTo(0)
  })

  test('returns positive value for different descriptors', () => {
    const a = makeDescriptor(0)
    const b = makeDescriptor(1)
    expect(euclideanDistance(a, b)).toBeGreaterThan(0)
  })
})

describe('findMatch', () => {
  const desc = makeDescriptor(0)

  test('returns userId for close match', () => {
    const users = [
      { id: 'user-1', faceDescriptor: makeDescriptor(0.001) },
      { id: 'user-2', faceDescriptor: makeDescriptor(5) },
    ]
    const result = findMatch(desc, users)
    expect(result).toBe('user-1')
  })

  test('returns null when no descriptor is within threshold', () => {
    const users = [
      { id: 'user-1', faceDescriptor: makeDescriptor(5) },
    ]
    expect(findMatch(desc, users)).toBeNull()
  })

  test('returns null for empty user list', () => {
    expect(findMatch(desc, [])).toBeNull()
  })

  test('returns closest match when multiple are within threshold', () => {
    const users = [
      { id: 'user-far', faceDescriptor: makeDescriptor(0.3) },
      { id: 'user-close', faceDescriptor: makeDescriptor(0.001) },
    ]
    expect(findMatch(desc, users)).toBe('user-close')
  })
})

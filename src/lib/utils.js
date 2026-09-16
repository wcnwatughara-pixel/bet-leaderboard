// ============================================
// DATE UTILITIES
// All leaderboard logic uses WAT (UTC+1)
// Weeks run Friday 00:00 to Thursday 23:59 WAT
// ============================================

const WAT_OFFSET_MS = 1 * 60 * 60 * 1000 // UTC+1

// Convert a UTC date to WAT
export function toWAT(date) {
  return new Date(date.getTime() + WAT_OFFSET_MS)
}

// Get the start of the current leaderboard week (Friday 00:00 WAT)
// dayOfWeek: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
// We need to find the most recent Friday in WAT
export function getCurrentWeekStart() {
  const now = toWAT(new Date())
  const day = now.getUTCDay() // 0-6
  // Days since last Friday: if today is Fri(5)=0, Sat(6)=1, Sun(0)=2, Mon(1)=3, Tue(2)=4, Wed(3)=5, Thu(4)=6
  const daysSinceFriday = (day + 2) % 7
  const friday = new Date(now)
  friday.setUTCDate(friday.getUTCDate() - daysSinceFriday)
  friday.setUTCHours(0, 0, 0, 0)
  // Convert back to UTC for database queries
  return new Date(friday.getTime() - WAT_OFFSET_MS)
}

// Get the end of the current leaderboard week (Thursday 23:59:59 WAT)
export function getCurrentWeekEnd() {
  const start = getCurrentWeekStart()
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  end.setUTCMilliseconds(-1)
  return end
}

// Get week start for a specific date
export function getWeekStartForDate(date) {
  const wat = toWAT(date)
  const day = wat.getUTCDay()
  const daysSinceFriday = (day + 2) % 7
  const friday = new Date(wat)
  friday.setUTCDate(friday.getUTCDate() - daysSinceFriday)
  friday.setUTCHours(0, 0, 0, 0)
  return new Date(friday.getTime() - WAT_OFFSET_MS)
}

// Format a date range for display: "Sep 12 - Sep 18"
export function formatWeekRange(weekStartUTC) {
  const start = toWAT(weekStartUTC)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const opts = { month: 'short', day: 'numeric' }
  const startStr = start.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
  const endStr = end.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
  return `${startStr} - ${endStr}`
}

// Get a list of past weeks for the dropdown, most recent first
export function getPastWeeks(count = 8) {
  const weeks = []
  let current = getCurrentWeekStart()
  for (let i = 0; i < count; i++) {
    weeks.push(new Date(current))
    current = new Date(current)
    current.setUTCDate(current.getUTCDate() - 7)
  }
  return weeks
}

// ============================================
// IMAGE COMPRESSION
// Resize and compress screenshots before upload
// Target: 800px wide, 80% JPEG quality
// ============================================

export function compressImage(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    // Reject non-image files
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      reject(new Error('Only JPG, PNG, and WebP images are accepted.'))
      return
    }

    // Reject files over 5MB
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Image must be under 5MB.'))
      return
    }

    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to JPEG blob at specified quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              // Fallback: if compression fails, return original file
              resolve(file)
            }
          },
          'image/jpeg',
          quality
        )
      } catch (err) {
        // Fallback for low-end devices: return original file
        resolve(file)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image.'))
    }

    img.src = URL.createObjectURL(file)
  })
}

// ============================================
// LEADERBOARD CALCULATIONS
// ROI and stats computation from bet arrays
// ============================================

// Calculate stats for a single user's bets
export function calculateUserStats(bets) {
  if (!bets || bets.length === 0) {
    return {
      totalBets: 0,
      wins: 0,
      losses: 0,
      totalStaked: 0,
      totalReturns: 0,
      roi: 0,
      winRate: 0,
      streak: { type: null, count: 0, avgOdds: 0 },
    }
  }

  const wins = bets.filter(b => b.outcome === 'win')
  const losses = bets.filter(b => b.outcome === 'loss')
  const totalStaked = bets.reduce((sum, b) => sum + Number(b.stake), 0)

  // Returns = sum of (stake * odds) for wins only
  const totalReturns = wins.reduce((sum, b) => sum + Number(b.stake) * Number(b.odds), 0)

  // ROI = (returns - totalStaked) / totalStaked * 100
  const roi = totalStaked > 0 ? ((totalReturns - totalStaked) / totalStaked) * 100 : 0

  // Win rate = wins / total * 100
  const winRate = bets.length > 0 ? (wins.length / bets.length) * 100 : 0

  // Calculate current streak (most recent bets first)
  const sorted = [...bets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const streakType = sorted[0]?.outcome || null
  let streakCount = 0
  let streakOddsSum = 0
  for (const bet of sorted) {
    if (bet.outcome === streakType) {
      streakCount++
      streakOddsSum += Number(bet.odds)
    } else {
      break
    }
  }

  return {
    totalBets: bets.length,
    wins: wins.length,
    losses: losses.length,
    totalStaked,
    totalReturns,
    roi: Math.round(roi * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    streak: {
      type: streakType,
      count: streakCount,
      avgOdds: streakCount > 0 ? Math.round((streakOddsSum / streakCount) * 100) / 100 : 0,
    },
  }
}

// Build leaderboard rankings from all users' bets
// minBets: minimum settled bets to qualify
export function buildLeaderboard(userBetsMap, minBets = 3) {
  const entries = []

  for (const [userId, { username, bets }] of Object.entries(userBetsMap)) {
    const stats = calculateUserStats(bets)
    entries.push({
      userId,
      username,
      ...stats,
      qualified: stats.totalBets >= minBets,
    })
  }

  // Sort qualified users by: win rate desc, then ROI desc, then totalBets desc, then username asc
  const qualified = entries
    .filter(e => e.qualified)
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate
      if (b.roi !== a.roi) return b.roi - a.roi
      if (b.totalBets !== a.totalBets) return b.totalBets - a.totalBets
      return a.username.localeCompare(b.username)
    })

  // Assign ranks
  qualified.forEach((entry, i) => {
    entry.rank = i + 1
  })

  // Unqualified users (sorted by bet count desc so people can see who's close)
  const unqualified = entries
    .filter(e => !e.qualified)
    .sort((a, b) => b.totalBets - a.totalBets)

  return { qualified, unqualified, totalUsers: entries.length }
}

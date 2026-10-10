/**
 * Resolves the authoritative course a public enrollment request refers to.
 *
 * Enrollment is recorded as a lead, but clients only ever send a course slug.
 * The server looks the course up and derives the canonical title and price, so
 * a tampered client cannot enroll against an unpublished course or a made-up
 * price. Kept pure so it can be unit tested without a database.
 */

export type EnrollmentCourseRow = {
  title: string
  price_ngn: number
  is_published: boolean
}

export type EnrollmentCourseSummary = {
  title: string
  priceNgn: number
}

export function resolveEnrollmentCourse(
  row: EnrollmentCourseRow | null | undefined
): EnrollmentCourseSummary | null {
  if (!row || !row.is_published) return null
  if (typeof row.title !== "string" || row.title.trim().length === 0) return null

  return {
    title: row.title.trim(),
    priceNgn: Number.isFinite(row.price_ngn) ? row.price_ngn : 0,
  }
}

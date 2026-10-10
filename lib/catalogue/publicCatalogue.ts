import type { Database } from "@/types/supabase"
import type { CourseOffering } from "@/lib/data/courses"

/**
 * Pure, database-agnostic mapping between the Supabase catalogue tables and the
 * public `CourseOffering` shape the Learning Hub renders.
 *
 * The database is the source of truth for the public catalogue; lib/data/courses.ts
 * only seeds it. Keeping the mapping side-effect free lets it be unit tested
 * without a database.
 */

type CourseRow = Database["public"]["Tables"]["courses"]["Row"]
type ModuleRow = Database["public"]["Tables"]["course_modules"]["Row"]
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"]

/** The only format the Learning Hub currently offers. */
export const CATALOGUE_COURSE_FORMAT = "Online Training" as const

export const CATALOGUE_UNAVAILABLE_MESSAGE =
  "The course catalogue is temporarily unavailable. Please try again in a moment."

export type CatalogueCourseInput = Pick<
  CourseRow,
  | "id"
  | "slug"
  | "title"
  | "category"
  | "level"
  | "price_ngn"
  | "duration"
  | "short_description"
  | "overview"
  | "learning_outcomes"
  | "prerequisites"
  | "is_popular"
>

export type CatalogueModuleInput = Pick<
  ModuleRow,
  "id" | "course_id" | "title" | "order_index"
>

export type CatalogueLessonInput = Pick<
  LessonRow,
  "id" | "module_id" | "title" | "order_index"
>

export type PublicCatalogueResult =
  | { status: "ok"; courses: CourseOffering[] }
  | { status: "unavailable"; message: string }

export type PublicCourseResult =
  | { status: "ok"; course: CourseOffering }
  | { status: "not_found" }
  | { status: "unavailable"; message: string }

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  )
}

function byOrderIndex<T extends { order_index: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order_index - b.order_index)
}

/**
 * Maps one `courses` row plus its modules and lessons to the public shape.
 * Modules and lessons are ordered by `order_index` so the syllabus renders in
 * the order the admin arranged it.
 */
export function mapCourseOffering(
  course: CatalogueCourseInput,
  modules: CatalogueModuleInput[],
  lessons: CatalogueLessonInput[]
): CourseOffering {
  const courseModules = byOrderIndex(
    modules.filter((module) => module.course_id === course.id)
  )

  const syllabus = courseModules.map((module) => ({
    moduleTitle: module.title,
      topics: byOrderIndex(
      lessons.filter((lesson) => lesson.module_id === module.id)
    ).map((lesson) => lesson.title),
  }))

  return {
    slug: course.slug,
    title: course.title,
    category: course.category,
    level: course.level,
    priceNgn: Number(course.price_ngn ?? 0),
    duration: course.duration,
    format: CATALOGUE_COURSE_FORMAT,
    shortDescription: course.short_description,
    overview: course.overview,
    learningOutcomes: toStringArray(course.learning_outcomes),
    prerequisites: course.prerequisites ?? "",
    syllabus,
    isPopular: course.is_popular,
  }
}

export function mapCourseOfferings(
  courses: CatalogueCourseInput[],
  modules: CatalogueModuleInput[],
  lessons: CatalogueLessonInput[]
): CourseOffering[] {
  return courses.map((course) => mapCourseOffering(course, modules, lessons))
}

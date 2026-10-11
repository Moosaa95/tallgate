import "server-only"

import { cache } from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  CATALOGUE_UNAVAILABLE_MESSAGE,
  mapCourseOffering,
  mapCourseOfferings,
  type PublicCatalogueResult,
  type PublicCourseResult,
} from "@/lib/catalogue/publicCatalogue"
import { logError } from "@/lib/logging/logger"

/**
 * Server-side reads of the published Learning Hub catalogue.
 *
 * Supabase is the single source of truth: the public pages read published
 * courses (and their modules/lessons) from the database, so admin edits show up
 * publicly. When the database is not configured or a query fails we return an
 * explicit `unavailable` result instead of falling back to stale static data.
 */

async function loadPublishedCatalogue(): Promise<PublicCatalogueResult> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: CATALOGUE_UNAVAILABLE_MESSAGE }
  }

  const supabase = await createClient()

  const { data: courses, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true })

  if (courseError) {
    logError("catalogue.published_courses_failed", courseError)
    return { status: "unavailable", message: CATALOGUE_UNAVAILABLE_MESSAGE }
  }

  if (!courses || courses.length === 0) {
    return { status: "ok", courses: [] }
  }

  const { data: modules, error: moduleError } = await supabase
    .from("course_modules")
    .select("*")
    .in(
      "course_id",
      courses.map((course) => course.id)
    )
    .order("order_index", { ascending: true })

  if (moduleError) {
    logError("catalogue.course_modules_failed", moduleError)
    return { status: "unavailable", message: CATALOGUE_UNAVAILABLE_MESSAGE }
  }

  const moduleIds = (modules ?? []).map((module) => module.id)
  const lessons = moduleIds.length > 0 ? await loadLessons(moduleIds) : []

  if (lessons === null) {
    return { status: "unavailable", message: CATALOGUE_UNAVAILABLE_MESSAGE }
  }

  return {
    status: "ok",
    courses: mapCourseOfferings(courses, modules ?? [], lessons),
  }
}

async function loadLessons(moduleIds: string[]) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .in("module_id", moduleIds)
    .order("order_index", { ascending: true })

  if (error) {
    logError("catalogue.course_lessons_failed", error)
    return null
  }

  return data ?? []
}

export const getPublishedCatalogue = cache(loadPublishedCatalogue)

async function loadPublishedCourse(slug: string): Promise<PublicCourseResult> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: CATALOGUE_UNAVAILABLE_MESSAGE }
  }

  const supabase = await createClient()

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (courseError) {
    logError("catalogue.course_failed", courseError, { slug })
    return { status: "unavailable", message: CATALOGUE_UNAVAILABLE_MESSAGE }
  }

  if (!course) {
    return { status: "not_found" }
  }

  const { data: modules, error: moduleError } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", course.id)
    .order("order_index", { ascending: true })

  if (moduleError) {
    logError("catalogue.course_modules_failed", moduleError, { slug })
    return { status: "unavailable", message: CATALOGUE_UNAVAILABLE_MESSAGE }
  }

  const moduleIds = (modules ?? []).map((module) => module.id)
  const lessons = moduleIds.length > 0 ? await loadLessons(moduleIds) : []

  if (lessons === null) {
    return { status: "unavailable", message: CATALOGUE_UNAVAILABLE_MESSAGE }
  }

  return {
    status: "ok",
    course: mapCourseOffering(course, modules ?? [], lessons),
  }
}

export const getPublishedCourseBySlug = cache(loadPublishedCourse)

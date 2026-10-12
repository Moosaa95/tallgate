import { describe, expect, it } from "vitest"
import {
  CATALOGUE_COURSE_FORMAT,
  mapCourseOffering,
  mapCourseOfferings,
  type CatalogueCourseInput,
  type CatalogueLessonInput,
  type CatalogueModuleInput,
} from "@/lib/catalogue/publicCatalogue"

function makeCourse(overrides: Partial<CatalogueCourseInput> = {}): CatalogueCourseInput {
  return {
    id: "course-1",
    slug: "developer-package",
    title: "Developer Package",
    category: "Engineering",
    level: "Advanced",
    price_ngn: 250000,
    duration: "12 Weeks",
    short_description: "Ship production software.",
    overview: "A deep dive into modern software delivery.",
    learning_outcomes: ["Build APIs", "Write tests"],
    prerequisites: "Basic programming",
    is_popular: true,
    ...overrides,
  }
}

function makeModule(overrides: Partial<CatalogueModuleInput> = {}): CatalogueModuleInput {
  return {
    id: "module-1",
    course_id: "course-1",
    title: "Foundations",
    order_index: 1,
    ...overrides,
  }
}

function makeLesson(overrides: Partial<CatalogueLessonInput> = {}): CatalogueLessonInput {
  return {
    id: "lesson-1",
    module_id: "module-1",
    title: "Introduction",
    order_index: 1,
    ...overrides,
  }
}

describe("mapCourseOffering", () => {
  it("maps a database course row to the public course shape", () => {
    const course = mapCourseOffering(makeCourse(), [], [])

    expect(course).toEqual({
      slug: "developer-package",
      title: "Developer Package",
      category: "Engineering",
      level: "Advanced",
      priceNgn: 250000,
      duration: "12 Weeks",
      format: CATALOGUE_COURSE_FORMAT,
      shortDescription: "Ship production software.",
      overview: "A deep dive into modern software delivery.",
      learningOutcomes: ["Build APIs", "Write tests"],
      prerequisites: "Basic programming",
      syllabus: [],
      isPopular: true,
    })
  })

  it("orders modules and lessons by order_index regardless of input order", () => {
    const course = mapCourseOffering(
      makeCourse(),
      [
        makeModule({ id: "module-b", title: "Second", order_index: 2 }),
        makeModule({ id: "module-a", title: "First", order_index: 1 }),
      ],
      [
        makeLesson({ id: "l2", module_id: "module-a", title: "Lesson two", order_index: 2 }),
        makeLesson({ id: "l1", module_id: "module-a", title: "Lesson one", order_index: 1 }),
        makeLesson({ id: "l3", module_id: "module-b", title: "Other", order_index: 1 }),
      ]
    )

    expect(course.syllabus).toEqual([
      { moduleTitle: "First", topics: ["Lesson one", "Lesson two"] },
      { moduleTitle: "Second", topics: ["Other"] },
    ])
  })

  it("only includes modules and lessons that belong to the course", () => {
    const course = mapCourseOffering(
      makeCourse(),
      [
        makeModule({ id: "module-1" }),
        makeModule({ id: "module-x", course_id: "course-2", title: "Foreign" }),
      ],
      [
        makeLesson({ id: "l1", module_id: "module-1" }),
        makeLesson({ id: "l2", module_id: "module-x", title: "Foreign lesson" }),
      ]
    )

    expect(course.syllabus).toEqual([{ moduleTitle: "Foundations", topics: ["Introduction"] }])
  })

  it("drops non-string and blank learning outcomes and defaults null prerequisites", () => {
    const course = mapCourseOffering(
      makeCourse({
        learning_outcomes: ["Valid", "", "   ", 42, null, { nested: true }],
        prerequisites: null,
      }),
      [],
      []
    )

    expect(course.learningOutcomes).toEqual(["Valid"])
    expect(course.prerequisites).toBe("")
  })
})

describe("mapCourseOfferings", () => {
  it("maps each course with only its own modules and lessons", () => {
    const courses = mapCourseOfferings(
      [
        makeCourse({ id: "course-1", slug: "appreciation-package", title: "Appreciation" }),
        makeCourse({ id: "course-2", slug: "developer-package", title: "Developer" }),
      ],
      [
        makeModule({ id: "module-a", course_id: "course-1", title: "Basics", order_index: 1 }),
        makeModule({ id: "module-b", course_id: "course-2", title: "Engineering", order_index: 1 }),
      ],
      [
        makeLesson({ id: "lesson-a", module_id: "module-a", title: "Using a computer", order_index: 1 }),
        makeLesson({ id: "lesson-b", module_id: "module-b", title: "Shipping code", order_index: 1 }),
      ]
    )

    expect(courses.map((course) => course.slug)).toEqual([
      "appreciation-package",
      "developer-package",
    ])
    expect(courses[0].syllabus).toEqual([
      { moduleTitle: "Basics", topics: ["Using a computer"] },
    ])
    expect(courses[1].syllabus).toEqual([
      { moduleTitle: "Engineering", topics: ["Shipping code"] },
    ])
  })

  it("returns an empty array when there are no courses", () => {
    expect(mapCourseOfferings([], [], [])).toEqual([])
  })
})

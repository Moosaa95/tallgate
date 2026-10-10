import { getPublishedCatalogue } from "@/lib/catalogue/getPublicCatalogue"
import HomePageContent from "./HomePageContent"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const catalogue = await getPublishedCatalogue()
  const catalogueUnavailable = catalogue.status === "unavailable"
  const featuredCourses =
    catalogue.status === "ok" ? catalogue.courses.slice(0, 3) : []

  return (
    <HomePageContent
      featuredCourses={featuredCourses}
      catalogueUnavailable={catalogueUnavailable}
      catalogueMessage={
        catalogue.status === "unavailable" ? catalogue.message : undefined
      }
    />
  )
}

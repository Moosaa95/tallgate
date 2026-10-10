import { getPublishedCatalogue } from "@/lib/catalogue/getPublicCatalogue"
import UserCoursesContent from "./UserCoursesContent"

export const dynamic = "force-dynamic"

export default async function UserCoursesPage() {
  const catalogue = await getPublishedCatalogue()
  const catalogueUnavailable = catalogue.status === "unavailable"

  return (
    <UserCoursesContent
      courses={catalogue.status === "ok" ? catalogue.courses : []}
      catalogueUnavailable={catalogueUnavailable}
      catalogueMessage={
        catalogue.status === "unavailable" ? catalogue.message : undefined
      }
    />
  )
}

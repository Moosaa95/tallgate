import { getPublishedCatalogue } from "@/lib/catalogue/getPublicCatalogue"
import CatalogueNotice from "@/features/learning/CatalogueNotice"
import SectionHeader from "@/components/ui/SectionHeader"
import LearningHubContent from "./LearningHubContent"

export const dynamic = "force-dynamic"

export default async function LearningHubPage() {
  const catalogue = await getPublishedCatalogue()

  if (catalogue.status === "unavailable") {
    return (
      <div className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Official Online Training Packages"
            description="Choose a practical TallGate online package designed to build your digital, technical, and professional skills."
          />
          <CatalogueNotice message={catalogue.message} />
        </div>
      </div>
    )
  }

  return <LearningHubContent courses={catalogue.courses} />
}

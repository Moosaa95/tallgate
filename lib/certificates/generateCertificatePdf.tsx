import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { siteConfig } from '@/lib/config/site'
import { formatCertificateIssueDate } from '@/lib/certificates/date'

export interface CertificateData {
  recipient_name: string
  course_title: string
  issue_date: string
  grade: string | null
  certificate_number: string
  verification_code: string
  verification_url: string
  qr_data_url: string
  logo_src?: string
}

const NAVY = '#061A4F'
const NAVY_DEEP = '#040F35'
const NAVY_MID = '#0B2458'
const GOLD = '#C9A24B'
const GOLD_DEEP = '#A8823A'
const GOLD_LIGHT = '#E6CD8F'
const INK = '#334155'
const SLATE = '#64748B'

const CORNER_SIZE = 46
const PAGE_PADDING = 16

const cornerFrames = {
  tl: { borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopColor: GOLD, borderLeftColor: GOLD },
  tr: { borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopColor: GOLD, borderRightColor: GOLD },
  bl: { borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomColor: GOLD, borderLeftColor: GOLD },
  br: { borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomColor: GOLD, borderRightColor: GOLD },
} as const

const cornerInnerFrames = {
  tl: { borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: NAVY, borderLeftColor: NAVY },
  tr: { borderTopWidth: 1, borderRightWidth: 1, borderTopColor: NAVY, borderRightColor: NAVY },
  bl: { borderBottomWidth: 1, borderLeftWidth: 1, borderBottomColor: NAVY, borderLeftColor: NAVY },
  br: { borderBottomWidth: 1, borderRightWidth: 1, borderBottomColor: NAVY, borderRightColor: NAVY },
} as const

const styles = StyleSheet.create({
  page: {
    padding: PAGE_PADDING,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  frameGold: {
    flex: 1,
    borderWidth: 1.2,
    borderColor: GOLD,
    padding: 9,
  },
  frameNavy: {
    flex: 1,
    borderWidth: 0.8,
    borderColor: NAVY_MID,
    paddingHorizontal: 30,
    paddingVertical: 24,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerInner: {
    position: 'absolute',
    width: CORNER_SIZE - 12,
    height: CORNER_SIZE - 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '55%',
  },
  logo: {
    width: 34,
    height: 34,
    marginRight: 10,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: NAVY,
    textTransform: 'uppercase' as const,
  },
  rcLine: {
    fontSize: 7,
    letterSpacing: 1.4,
    marginTop: 2,
    color: SLATE,
  },
  certNumberCol: {
    alignItems: 'flex-end',
    maxWidth: '42%',
  },
  certNumberLabel: {
    fontSize: 6.5,
    letterSpacing: 2.2,
    color: GOLD_DEEP,
    textTransform: 'uppercase' as const,
  },
  certNumber: {
    fontSize: 9.5,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 3,
    textAlign: 'right',
    color: NAVY_DEEP,
  },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 27,
    fontWeight: 'bold',
    letterSpacing: 3.5,
    textTransform: 'uppercase' as const,
    textAlign: 'center',
    color: NAVY_DEEP,
  },
  headingUnderline: {
    width: 230,
    height: 1.6,
    backgroundColor: GOLD,
    marginTop: 10,
  },
  headingUnderlineInner: {
    width: 120,
    height: 1,
    backgroundColor: NAVY_MID,
    alignSelf: 'center' as const,
    marginTop: 2,
  },
  lede: {
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 26,
    color: INK,
  },
  name: {
    fontFamily: 'Times-Roman',
    fontStyle: 'italic' as const,
    fontSize: 26,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 20,
    textAlign: 'center',
    color: NAVY_DEEP,
  },
  sub: {
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 8,
    color: INK,
  },
  course: {
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 10,
    paddingHorizontal: 8,
    textAlign: 'center',
    color: NAVY,
  },
  grade: {
    fontSize: 10.5,
    letterSpacing: 1,
    marginTop: 9,
    color: INK,
  },
  citation: {
    fontSize: 10.5,
    letterSpacing: 1,
    marginTop: 12,
    color: INK,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    borderWidth: 1.2,
    borderColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 9,
    marginTop: 18,
  },
  dateBadgeText: {
    fontSize: 10.5,
    letterSpacing: 2.2,
    color: GOLD_LIGHT,
    textTransform: 'uppercase' as const,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  signatureSection: {
    alignItems: 'center',
    width: 190,
  },
  signatureLine: {
    width: 168,
    borderBottomWidth: 1.2,
    borderBottomColor: SLATE,
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: NAVY,
    textTransform: 'uppercase' as const,
  },
  qrSection: {
    alignItems: 'center',
    width: 130,
  },
  qr: {
    width: 88,
    height: 88,
  },
  qrCaption: {
    fontSize: 7.5,
    letterSpacing: 1.2,
    marginTop: 5,
    textAlign: 'center',
    color: NAVY,
  },
  verificationCode: {
    fontSize: 6.5,
    letterSpacing: 1,
    marginTop: 3,
    textAlign: 'center',
    color: SLATE,
  },
  legal: {
    fontSize: 6.5,
    letterSpacing: 1,
    marginTop: 4,
    textAlign: 'center',
    color: SLATE,
  },
})

type CornerVariant = 'tl' | 'tr' | 'bl' | 'br'

type CornerOffset = { top?: number; left?: number; right?: number; bottom?: number }

const cornerOffsets: Record<CornerVariant, CornerOffset> = {
  tl: { top: PAGE_PADDING, left: PAGE_PADDING },
  tr: { top: PAGE_PADDING, right: PAGE_PADDING },
  bl: { bottom: PAGE_PADDING, left: PAGE_PADDING },
  br: { bottom: PAGE_PADDING, right: PAGE_PADDING },
}

function Corner({ variant }: { variant: CornerVariant }) {
  const offset = cornerOffsets[variant]
  return (
    <>
      <View style={[styles.corner, offset, cornerFrames[variant]]} />
      <View
        style={[
          styles.cornerInner,
          {
            top: offset.top !== undefined ? offset.top + 6 : undefined,
            left: offset.left !== undefined ? offset.left + 6 : undefined,
            right: offset.right !== undefined ? offset.right + 6 : undefined,
            bottom: offset.bottom !== undefined ? offset.bottom + 6 : undefined,
          },
          cornerInnerFrames[variant],
        ]}
      />
    </>
  )
}

function formatIssueDate(issueDate: string): string {
  return formatCertificateIssueDate(issueDate, 'long')
}

export function CertificateDocument({
  data,
}: {
  data: CertificateData
}): ReactElement {
  const logoSource = data.logo_src || null

  return (
    <Document
      title={`${siteConfig.companyName} Certificate ${data.certificate_number}`}
      author={siteConfig.companyName}
      subject={data.course_title}
      keywords={`certificate,${data.verification_code},${data.certificate_number}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Corner variant="tl" />
        <Corner variant="tr" />
        <Corner variant="bl" />
        <Corner variant="br" />

        <View style={styles.frameGold}>
          <View style={styles.frameNavy}>
            <View style={styles.header}>
              <View style={styles.brand}>
                {logoSource ? <PdfImage src={logoSource} style={styles.logo} /> : null}
                <View>
                  <Text style={styles.companyName}>{siteConfig.companyName}</Text>
                  <Text style={styles.rcLine}>RC {siteConfig.rcNumber} &middot; Registered in Nigeria</Text>
                </View>
              </View>

              <View style={styles.certNumberCol}>
                <Text style={styles.certNumberLabel}>Certificate No.</Text>
                <Text style={styles.certNumber}>{data.certificate_number}</Text>
              </View>
            </View>

            <View style={styles.body}>
              <Text style={styles.heading}>Certificate of Completion</Text>
              <View style={styles.headingUnderline}>
                <View style={styles.headingUnderlineInner} />
              </View>

              <Text style={styles.lede}>This is to certify that</Text>
              <Text style={styles.name}>{data.recipient_name}</Text>
              <Text style={styles.sub}>has successfully completed the programme</Text>
              <Text style={styles.course}>{data.course_title}</Text>
              {data.grade ? (
                <Text style={styles.grade}>awarded with the standing of {data.grade}</Text>
              ) : null}
              <Text style={styles.citation}>and is hereby presented with this certificate</Text>

              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>Issued on {formatIssueDate(data.issue_date)}</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={styles.signatureSection}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Training Coordinator</Text>
              </View>

              <View style={styles.qrSection}>
                <PdfImage src={data.qr_data_url} style={styles.qr} />
                <Text style={styles.qrCaption}>Scan to verify certificate</Text>
                <Text style={styles.verificationCode}>{data.verification_code}</Text>
              </View>

              <View style={styles.signatureSection}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Programme Director</Text>
              </View>
            </View>

            <Text style={styles.legal}>
              {siteConfig.companyName} &middot; {siteConfig.tagline}
            </Text>
            <Text style={styles.legal}>
              Verify this certificate at {data.verification_url} or with code {data.verification_code}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  return renderToBuffer(<CertificateDocument data={data} />)
}
import {
  Circle,
  Document,
  Image as PdfImage,
  Line,
  Page,
  Path,
  Polygon,
  Rect,
  StyleSheet,
  Svg,
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
const NAVY_MID = '#0B2458'
const GOLD = '#C9A24B'
const GOLD_LIGHT = '#F4D086'
const SLATE_DARK = '#1E293B'
const SLATE = '#64748B'
const SLATE_LIGHT = '#94A3B8'

const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    fontFamily: 'Helvetica',
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 48,
    paddingTop: 36,
    paddingBottom: 28,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  certNumberRow: {
    position: 'absolute',
    top: 36,
    right: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  certNumberText: {
    fontFamily: 'Times-Roman',
    fontSize: 9.5,
    color: NAVY,
    letterSpacing: 0.3,
  },
  certNumberDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginLeft: 3,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  brandMark: {
    width: 34,
    height: 34,
  },
  companyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13.5,
    letterSpacing: 2.8,
    color: NAVY,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  rcLine: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: SLATE_DARK,
    marginTop: 2,
  },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    marginTop: 6,
  },
  mainHeading: {
    fontFamily: 'Times-Bold',
    fontSize: 25.5,
    letterSpacing: 2.5,
    color: NAVY,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  presentedTo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    letterSpacing: 2.2,
    color: GOLD,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 10,
  },
  recipientName: {
    fontFamily: 'Times-Bold',
    letterSpacing: 1,
    color: NAVY,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 250,
    marginTop: 4,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: GOLD,
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
    marginHorizontal: 8,
  },
  completionIntro: {
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: SLATE_DARK,
    textAlign: 'center',
    marginTop: 2,
  },
  courseTitle: {
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 3,
    maxWidth: 560,
    lineHeight: 1.3,
  },
  completionCitation: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: SLATE_DARK,
    textAlign: 'center',
    lineHeight: 1.35,
    maxWidth: 520,
  },
  gradeCitation: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: SLATE,
    textAlign: 'center',
    marginTop: 3,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVY,
    borderWidth: 1.2,
    borderColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 5.5,
    marginTop: 10,
  },
  dateBadgeText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: GOLD_LIGHT,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: 54,
    marginBottom: 10,
  },
  signerColumn: {
    alignItems: 'center',
    width: 170,
  },
  signerLine: {
    width: 140,
    height: 1,
    backgroundColor: SLATE_LIGHT,
    marginBottom: 6,
  },
  signerRole: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: NAVY,
    textAlign: 'center',
  },
  signerOrg: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: NAVY,
    textAlign: 'center',
    marginTop: 2,
  },
  qrColumn: {
    alignItems: 'center',
    width: 130,
    marginTop: -4,
  },
  qrImage: {
    width: 64,
    height: 64,
  },
  qrCaption: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    letterSpacing: 0.3,
    color: SLATE_DARK,
    textAlign: 'center',
    marginTop: 4,
  },
})

function getHexagonPoints(cx: number, cy: number, r: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
}

function CertificateBackground(): ReactElement {
  const tlDots: Array<{ x: number; y: number }> = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      const x = 20 + col * 20
      const y = 20 + row * 20
      if (x / 185 + y / 145 < 0.82) {
        tlDots.push({ x, y })
      }
    }
  }

  const brDots: Array<{ x: number; y: number }> = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      const x = PAGE_WIDTH - 20 - col * 20
      const y = PAGE_HEIGHT - 20 - row * 20
      if ((PAGE_WIDTH - x) / 185 + (PAGE_HEIGHT - y) / 145 < 0.82) {
        brDots.push({ x, y })
      }
    }
  }

  return (
    <View style={styles.backgroundLayer}>
      <Svg
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT}
        viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      >
        {/* 1. Top-Left Navy Geometric Corner */}
        <Polygon points="0,0 185,0 0,145" fill={NAVY} />
        <Polygon points="0,145 28,145 198,0 185,0" fill={NAVY_MID} />
        <Line x1={0} y1={145} x2={185} y2={0} stroke={GOLD} strokeWidth={2.4} />
        <Line x1={0} y1={155} x2={198} y2={0} stroke={GOLD} strokeWidth={0.9} strokeOpacity={0.65} />

        {/* Top-Left Dot Matrix */}
        {tlDots.map((dot, idx) => (
          <Circle key={`tld-${idx}`} cx={dot.x} cy={dot.y} r={1.6} fill={GOLD} opacity={0.85} />
        ))}

        {/* 2. Bottom-Right Navy Geometric Corner */}
        <Polygon points="657,595 842,595 842,450" fill={NAVY} />
        <Polygon points="657,595 644,595 842,437 842,450" fill={NAVY_MID} />
        <Line x1={657} y1={595} x2={842} y2={450} stroke={GOLD} strokeWidth={2.4} />
        <Line x1={644} y1={595} x2={842} y2={437} stroke={GOLD} strokeWidth={0.9} strokeOpacity={0.65} />

        {/* Bottom-Right Dot Matrix */}
        {brDots.map((dot, idx) => (
          <Circle key={`brd-${idx}`} cx={dot.x} cy={dot.y} r={1.6} fill={GOLD} opacity={0.85} />
        ))}

        {/* 3. Gold Framing Border with Node Accents */}
        <Line x1={28} y1={24} x2={814} y2={24} stroke={GOLD} strokeWidth={1.2} />
        <Line x1={28} y1={571} x2={814} y2={571} stroke={GOLD} strokeWidth={1.2} />
        <Line x1={28} y1={24} x2={28} y2={571} stroke={GOLD} strokeWidth={1.2} />
        <Line x1={814} y1={24} x2={814} y2={571} stroke={GOLD} strokeWidth={1.2} />

        {/* Border Corner Nodes */}
        <Circle cx={28} cy={24} r={3.2} fill={GOLD} />
        <Circle cx={814} cy={24} r={3.2} fill={GOLD} />
        <Circle cx={28} cy={571} r={3.2} fill={GOLD} />
        <Circle cx={814} cy={571} r={3.2} fill={GOLD} />

        {/* Border Mid-Edge Accent Nodes */}
        <Circle cx={195} cy={24} r={3.2} fill={GOLD} />
        <Circle cx={625} cy={24} r={3.2} fill={GOLD} />
        <Circle cx={195} cy={571} r={3.2} fill={GOLD} />
        <Circle cx={610} cy={571} r={3.2} fill={GOLD} />
        <Circle cx={28} cy={298} r={3.2} fill={GOLD} />
        <Circle cx={814} cy={298} r={3.2} fill={GOLD} />

        {/* 4. Bottom-Left Healthcare Watermark Icons */}
        <Polygon points={getHexagonPoints(72, 370, 26)} stroke={SLATE_LIGHT} strokeWidth={1} fill="none" opacity={0.18} />
        <Rect x={69} y={358} width={6} height={24} rx={1.5} fill={SLATE_LIGHT} opacity={0.16} />
        <Rect x={60} y={367} width={24} height={6} rx={1.5} fill={SLATE_LIGHT} opacity={0.16} />

        <Polygon points={getHexagonPoints(96, 312, 19)} stroke={SLATE_LIGHT} strokeWidth={1} fill="none" opacity={0.18} />
        <Path d="M96 303 L106 308 V316 C106 322 96 327 96 327 C96 327 86 322 86 316 V308 Z" fill="none" stroke={SLATE_LIGHT} strokeWidth={1.6} opacity={0.2} />

        <Polygon points={getHexagonPoints(124, 412, 22)} stroke={SLATE_LIGHT} strokeWidth={1} fill="none" opacity={0.18} />
        <Path d="M112 412 H118 L121 405 L125 419 L128 408 L131 412 H136" stroke={SLATE_LIGHT} strokeWidth={1.8} fill="none" opacity={0.22} />

        <Polygon points={getHexagonPoints(142, 472, 20)} stroke={SLATE_LIGHT} strokeWidth={1} fill="none" opacity={0.18} />
        <Circle cx={142} cy={466} r={3.5} fill={SLATE_LIGHT} opacity={0.18} />
        <Path d="M134 478 C134 473 137 472 142 472 C147 472 150 473 150 478" stroke={SLATE_LIGHT} strokeWidth={1.6} fill="none" opacity={0.18} />

        {/* Secondary Faint Hexagonal Accents */}
        <Polygon points={getHexagonPoints(48, 428, 17)} stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.12} />
        <Polygon points={getHexagonPoints(108, 468, 16)} stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.12} />
        <Polygon points={getHexagonPoints(54, 320, 15)} stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.1} />

        {/* 5. Right Subtle Globe Watermark */}
        <Circle cx={720} cy={320} r={140} stroke={SLATE_LIGHT} strokeWidth={1} fill="none" opacity={0.1} />
        <Path d="M583 300 Q720 330 857 300" stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.1} />
        <Path d="M592 260 Q720 290 848 260" stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.08} />
        <Path d="M592 380 Q720 350 848 380" stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.08} />
        <Path d="M580 340 Q720 370 860 340" stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.08} />
        <Path d="M720 180 Q660 320 720 460" stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.1} />
        <Path d="M720 180 Q780 320 720 460" stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.1} />
        <Path d="M720 180 Q610 320 720 460" stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.08} />
        <Path d="M720 180 Q830 320 720 460" stroke={SLATE_LIGHT} strokeWidth={0.8} fill="none" opacity={0.08} />
        <Path d="M660 270 Q690 250 720 280 T760 310 Q780 350 740 370 T680 350 Z" stroke={SLATE_LIGHT} strokeWidth={0.9} fill="none" opacity={0.09} />

        {/* 6. Title Flanking Accents */}
        <Line x1={60} y1={172} x2={160} y2={172} stroke={GOLD} strokeWidth={1} />
        <Circle cx={160} cy={172} r={3} fill={GOLD} />
        <Line x1={682} y1={172} x2={782} y2={172} stroke={GOLD} strokeWidth={1} />
        <Circle cx={682} cy={172} r={3} fill={GOLD} />
      </Svg>
    </View>
  )
}

function TallGateMark(): ReactElement {
  return (
    <Svg width={34} height={34} viewBox="0 0 48 48">
      {/* Outer Viewfinder Corner Brackets */}
      <Path d="M2 14V4C2 2.89543 2.89543 2 4 2H14" stroke={NAVY} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <Path d="M34 2H44C45.1046 2 46 2.89543 46 4V14" stroke={NAVY} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <Path d="M2 34V44C2 45.1046 2.89543 46 4 46H14" stroke={NAVY} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <Path d="M34 46H44C45.1046 46 46 45.1046 46 44V34" stroke={NAVY} strokeWidth={3.2} strokeLinecap="round" fill="none" />

      {/* Overlapping Offset Solid Rectangles */}
      <Rect x={9} y={9} width={22} height={22} fill={NAVY} rx={1.5} />
      <Rect x={17} y={17} width={22} height={22} fill={NAVY} rx={1.5} />

      {/* Center Cutout Box */}
      <Rect x={18} y={18} width={12} height={12} fill="#FFFFFF" rx={1} />

      {/* Center Mini Accent Square */}
      <Rect x={22} y={22} width={4} height={4} fill={NAVY} rx={0.5} />
    </Svg>
  )
}

function ShieldCheckIcon(): ReactElement {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" style={{ marginRight: 6 }}>
      <Path
        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
        fill="none"
        stroke={GOLD}
        strokeWidth={2}
      />
      <Path
        d="M9 12l2 2 4-4"
        fill="none"
        stroke={GOLD}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function CertificateDocument({
  data,
}: {
  data: CertificateData
}): ReactElement {
  const nameLen = data.recipient_name?.length || 0
  const nameFontSize = nameLen > 32 ? 26 : nameLen > 24 ? 30 : 36

  const courseLen = data.course_title?.length || 0
  const courseFontSize = courseLen > 65 ? 12 : courseLen > 45 ? 13.5 : 15

  const isHealthCourse = /health|telehealth|medical|clinical/i.test(data.course_title)

  return (
    <Document
      title={`${siteConfig.companyName} Certificate ${data.certificate_number}`}
      author={siteConfig.companyName}
      subject={data.course_title}
      keywords={`certificate,${data.verification_code},${data.certificate_number}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <CertificateBackground />

        <View style={styles.contentContainer}>
          {/* Upper-Right Certificate Number */}
          <View style={styles.certNumberRow}>
            <Text style={styles.certNumberText}>Certificate No: {data.certificate_number}</Text>
            <View style={styles.certNumberDot} />
          </View>

          {/* Centered Brand Header */}
          <View style={styles.header}>
            <View style={styles.brandMark}>
              {data.logo_src ? (
                <PdfImage src={data.logo_src} style={styles.brandMark} />
              ) : (
                <TallGateMark />
              )}
            </View>
            <Text style={styles.companyName}>{siteConfig.companyName}</Text>
            <Text style={styles.rcLine}>RC: {siteConfig.rcNumber}</Text>
          </View>

          {/* Main Certificate Body */}
          <View style={styles.body}>
            <Text style={styles.mainHeading}>CERTIFICATE OF COMPLETION</Text>
            <Text style={styles.presentedTo}>THIS CERTIFICATE IS PROUDLY PRESENTED TO</Text>
            <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
              {data.recipient_name}
            </Text>

            {/* Divider with Center Dot */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerDot} />
              <View style={styles.dividerLine} />
            </View>

            {/* Dynamic Course Completion Information */}
            <Text style={styles.completionIntro}>For successfully completing the</Text>
            <Text style={[styles.courseTitle, { fontSize: courseFontSize }]}>
              {data.course_title}
            </Text>
            <Text style={styles.completionCitation}>
              and demonstrating commitment to developing practical
            </Text>
            <Text style={styles.completionCitation}>
              {isHealthCourse
                ? 'knowledge and skills in digital healthcare'
                : 'knowledge and skills in digital technology'}
            </Text>
            {data.grade ? (
              <Text style={styles.gradeCitation}>awarded with the standing of {data.grade}</Text>
            ) : null}

            {/* Issue Date Badge */}
            <View style={styles.dateBadge}>
              <ShieldCheckIcon />
              <Text style={styles.dateBadgeText}>
                Issued on: {formatCertificateIssueDate(data.issue_date, 'ordinal')}
              </Text>
            </View>
          </View>

          {/* Footer: Signatures & QR Code */}
          <View style={styles.footer}>
            <View style={styles.signerColumn}>
              <View style={styles.signerLine} />
              <Text style={styles.signerRole}>Training Coordinator</Text>
              <Text style={styles.signerOrg}>Tallgate Limited</Text>
            </View>

            <View style={styles.qrColumn}>
              <PdfImage src={data.qr_data_url} style={styles.qrImage} />
              <Text style={styles.qrCaption}>scan to verify certificate</Text>
            </View>

            <View style={styles.signerColumn}>
              <View style={styles.signerLine} />
              <Text style={styles.signerRole}>Programme Director</Text>
              <Text style={styles.signerOrg}>Tallgate Limited</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  return renderToBuffer(<CertificateDocument data={data} />)
}
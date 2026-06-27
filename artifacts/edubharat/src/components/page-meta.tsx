import { Helmet } from "react-helmet-async";

const DEFAULT = {
  title: "EduBharat — AI Career Platform for India",
  description: "Master English, ace interviews, and land your dream job with EduBharat's AI-powered career tools built for Indian learners.",
  ogImage: "/opengraph.jpg",
};

export function PageMeta({
  title,
  description,
  ogImage,
  ogUrl,
  noindex,
}: {
  title: string;
  description: string;
  ogImage?: string;
  ogUrl?: string;
  noindex?: boolean;
}) {
  const fullTitle = title ? `${title} | EduBharat` : DEFAULT.title;
  const image = ogImage ?? DEFAULT.ogImage;
  const url = ogUrl ? `${import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}${ogUrl}` : undefined;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />
      {url && <meta property="og:url" content={url} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

export function HomeMeta({ canonicalUrl }: { canonicalUrl?: string }) {
  return (
    <Helmet>
      <title>{DEFAULT.title}</title>
      <meta name="description" content={DEFAULT.description} />
      <meta property="og:title" content={DEFAULT.title} />
      <meta property="og:description" content={DEFAULT.description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={DEFAULT.ogImage} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={DEFAULT.title} />
      <meta name="twitter:description" content={DEFAULT.description} />
      <meta name="twitter:image" content={DEFAULT.ogImage} />
      <link rel="canonical" href={canonicalUrl ?? "/"} />
    </Helmet>
  );
}

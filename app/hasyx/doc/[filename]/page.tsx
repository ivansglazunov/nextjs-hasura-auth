import mdData from "../md.json";
import DocFilePageClient from "./client";

export async function generateStaticParams() {
  // Extract filenames from the static md.json file
  const params = mdData.items
    .map((item) => {
      // Extract filename from URL like "/hasyx/doc/AI" -> "AI"
      const urlParts = item.url.split('/');
      const filename = urlParts[urlParts.length - 1];
      return filename;
    })
    .filter(Boolean) // Remove any empty strings
    .map((filename) => ({
      filename: filename,
    }));
  
  return params;
}

export default function DocFilePage() {
  return <DocFilePageClient />;
} 
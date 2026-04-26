import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { imageData, publicId } = await req.json();
  if (!imageData) {
    return NextResponse.json({ error: "imageData is required" }, { status: 400 });
  }

  const result = await cloudinary.uploader.upload(imageData, {
    folder: "helio/tours",
    public_id: publicId,
    overwrite: false,
  });

  return NextResponse.json({ url: result.secure_url });
}

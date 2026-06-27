import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { PageMeta } from "@/components/page-meta";

export default function NotFound() {
  return (
    <>
      <PageMeta title="Page Not Found" description="This page does not exist on EduBharat." noindex />
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            We couldn't find the page you were looking for. Head back to the EduBharat home page to continue your learning journey.
          </p>
        </CardContent>
      </Card>
    </div>
    </>
  );
}

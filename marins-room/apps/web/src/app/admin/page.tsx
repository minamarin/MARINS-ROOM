import Link from "next/link";
import { redirect } from "next/navigation";

import { serverApi } from "@/lib/api";

export const metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard for Marin's Room",
};

export const dynamic = "force-dynamic";

async function checkAdminAuth() {
  // Server-side admin check
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return false;
  }

  // Try to make an admin-only request
  const response = await serverApi.listChatSessions(1, 1);
  return response.success;
}

export default async function AdminPage() {
  const isAdmin = await checkAdminAuth();

  if (!isAdmin) {
    redirect("/");
  }

  // Fetch data in parallel
  const [sessionsRes, donationsRes, videosRes] = await Promise.all([
    serverApi.listChatSessions(1, 10),
    serverApi.listDonations(1, 10),
    serverApi.listVideos(1, 10),
  ]);

  const sessions = sessionsRes.success && sessionsRes.data ? sessionsRes.data.sessions : [];
  const donations = donationsRes.success && donationsRes.data ? donationsRes.data.items : [];
  const videos = videosRes.success && videosRes.data ? videosRes.data.items : [];

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Chat Sessions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center justify-between">
            Recent Chat Sessions
            <span className="text-sm font-normal text-gray-500">
              {sessionsRes.data?.total || 0} total
            </span>
          </h2>

          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">No chat sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/admin/sessions/${session.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">
                      {session.visitorName || "Anonymous"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        session.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {session.messageCount} messages •{" "}
                    {new Date(session.updatedAt).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Donations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center justify-between">
            Recent Donations
            <span className="text-sm font-normal text-gray-500">
              {donationsRes.data?.total || 0} total
            </span>
          </h2>

          {donations.length === 0 ? (
            <p className="text-gray-500 text-sm">No donations yet.</p>
          ) : (
            <div className="space-y-3">
              {donations.map((donation) => (
                <div
                  key={donation.id}
                  className="p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">
                      ${(donation.amount / 100).toFixed(2)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        donation.status === "CONFIRMED"
                          ? "bg-green-100 text-green-700"
                          : donation.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {donation.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {donation.name || donation.email || "Anonymous"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(donation.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Videos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center justify-between">
            Recent Videos
            <span className="text-sm font-normal text-gray-500">
              {videosRes.data?.total || 0} total
            </span>
          </h2>

          {videos.length === 0 ? (
            <p className="text-gray-500 text-sm">No videos yet.</p>
          ) : (
            <div className="space-y-3">
              {videos.map((video) => (
                <Link
                  key={video.id}
                  href={`/videos/${video.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="font-medium text-gray-900 mb-1 truncate">
                    {video.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(video.createdAt).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

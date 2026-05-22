// Placeholder animado que se muestra mientras se cargan los datos de stints.

export default function SkeletonRow({ driverCount }) {
    return (
        <tr className="border-b border-gray-800/50 animate-pulse">
            <td className="p-4 border-r border-gray-800 text-center bg-black/50 w-20">
                <div className="h-8 w-12 bg-gray-800 rounded mx-auto" />
            </td>
            {[...Array(driverCount)].map((_, i) => (
                <td key={i} className="border-r border-gray-800 p-5">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-800 rounded-full shrink-0" />
                            <div className="h-6 bg-gray-800 rounded w-20" />
                        </div>
                        <div className="h-px bg-gray-800" />
                        <div className="h-10 bg-gray-800 rounded w-36" />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="h-8 bg-gray-800 rounded" />
                            <div className="h-8 bg-gray-800 rounded" />
                        </div>
                        <div className="h-8 bg-gray-800 rounded w-20" />
                    </div>
                </td>
            ))}
        </tr>
    );
}
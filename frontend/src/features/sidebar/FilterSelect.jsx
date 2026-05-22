// Select reutilizable con label, spinner de carga y estado disabled unificados.

function Spinner() {
    return (
        <span className="inline-block w-3 h-3 border border-gray-500 border-t-red-500 rounded-full animate-spin ml-2" />
    );
}

export default function FilterSelect({ label, value, onChange, disabled, loading = false, children, className = 'mb-4' }) {
    return (
        <div className={className}>
            <label className="flex items-center mb-1 text-sm font-bold italic text-gray-300 uppercase tracking-wide">
                {label}
                {loading && <Spinner />}
            </label>
            <select
                className="w-full p-2 text-white bg-black border border-gray-500 rounded-sm shadow-inner focus:border-red-600 focus:outline-none disabled:opacity-40 font-bold"
                value={value}
                onChange={onChange}
                disabled={disabled}
            >
                <option value="">-- SELECT --</option>
                {children}
            </select>
        </div>
    );
}
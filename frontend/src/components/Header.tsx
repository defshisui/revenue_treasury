interface HeaderProps {
  title?: string
}

export default function Header({title = "LGU Revenue Administration System"
}: HeaderProps) {
  return (
    <section className="bg-linear-to-r from-blue-900 to-blue-600 px-8 py-8 text-white">
      <h1 className="text-2xl font-bold">
        {title}
      </h1>

      <p className="mt-2 text-sm opacity-90">
        Password, Security, Personal Details, and Account Management.
      </p>
    </section>
  )
}
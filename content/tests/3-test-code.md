+++
title = 'Test Code'
+++

## Code
### Inline
Some `code` embedded in a line of normal text: `{ "label": "hugo build" }` \
Some `code` embedded in a line of normal text: {{< hl json >}}{ "label": "hugo build" }{{< /hl >}}

### Standard
```json {id=CodeStandard}
{
	"label": "hugo build",
	"type": "shell",
	"command": "hugo",
}
```

### Highlighted
```cpp {lineNoStart=999, hl_lines="1-2", #CodeHighlighted}
// long long long long long long long long long long long long long long long long long long long long
inline u32 IndexToHandle(u32 index, u8 generation)
{
	Assert(index <= MaxIndex);
	u32 handle = ((index + 1) << IndexShift) | generation;
	return handle;
}
```

### Single Line
```cpp {#CodeSingleLine}
// hello
```

### Empty
```cpp {#CodeEmpty}
```

### Characters
`01 airlg \/|&$@*- {} [] <> () __ -- << >> || '' ""`

```txt {#CodeCharacters}
01 airlg \/|&$@*- {} [] <> () __ -- << >> || '' ""
```


### Languages
```cpp {#CppSyntax}
#pragma once

#ifndef ONCE
#define ONCE
#include "test.cpp"

#include <vector>
#include <typeinfo>
#include <xmmintrin.h>
#pragma comment(lib, "foolib")

#define FUNCTION_MACRO(x, ...) __VA_ARGS__ ## x #x
#define DEFINE \
	__FUNCTION__ __LINE__ \
	"line"

void
control()
{
	if (0) {} else {}
	switch (0) { case 0: default: break; }

	for (;;) { break; }
	while (0) { continue; }
	do { } while (0);

	try {} catch (...) {} throw 0;
	0 ? false : true;

	goto ExitLabel;
	ExitLabel:
	return;
}

static union {};
enum {};
enum struct A {};
enum class B {};
namespace N {}
struct C1 { virtual void Bar() = 0; };
struct C2 : public C1 { using C1a = C1; };
typedef int D;
using E = int;

template <typename, class... Us>
constexpr inline static int
keywords(const volatile int* parameter)
noexcept(0)
{
	static_assert(true);
	alignof(int);
	decltype(int);
	typeid(int);
	sizeof(int);

	static_cast<int*>(0);
	reinterpret_cast<int*>(0);
	const_cast<int*>(0);
	dynamic_cast<int*>(0);
}

template <typename, class... Us>
struct alignas(8) C3 final : private C2
{
	C3() = default;
	C3(C3&&) = delete;

	using C2::C2;
	using C2::Bar;
	using C2::C1a;

	mutable int y;
	volatile int* z;
	const int w = 0;
	static int a;
	static inline int b;
	constexpr static int c = 0;

	void Bar() override final {}
	void Bar2() const {}
	static void Bar3() {}
	void Bar4() noexcept(0) {}
	void Bar5() throw(int) {}

	explicit operator int() { return 0; }

public:
private:
protected:
};

[[nodiscard]] [[noreturn]] [[deprecated]]
[[using gnu: unused, fakeattribute]]
void attribute() {}

void types()
{
	int;
	std::size_t;
	__m128;
	enum Foo : int;
}

template<typename T = int> struct TemplateDefault {};

struct SOperators
{
	SOperators() = default;
	SOperators(int) {}

	void* operator new(size_t) { return 0; }
	void* operator new[](size_t) { return 0; }
	void operator delete(void*) {}
	void operator delete[](void*) {}

	void operator[](int) {}
	void operator&() {}
	void operator*() {}
	C1* operator->() { return 0; }
	void operator->*(int) {}
	operator int() { return 0; }

	void operator++() {}
	void operator++(int) {}
	void operator--() {}
	void operator--(int) {}
	void operator+() {}
	void operator-() {}

	void operator+(int) {}
	void operator-(int) {}
	void operator*(int) {}
	void operator/(int) {}
	void operator%(int) {}
	void operator+=(int) {}
	void operator-=(int) {}
	void operator*=(int) {}
	void operator/=(int) {}
	void operator%=(int) {}

	void operator~() {}
	void operator^(int) {}
	void operator&(int) {}
	void operator|(int) {}
	void operator^=(int) {}
	void operator&=(int) {}
	void operator|=(int) {}

	void operator=(int) {}
	void operator,(int) {}

	void operator&&(int) {}
	void operator||(int) {}
	void operator<(int) {}
	void operator>(int) {}
	void operator==(int) {}
	void operator<=(int) {}
	void operator>=(int) {}
	void operator!=(int) {}

	void operator<<(int) {}
	void operator>>(int) {}
	void operator<<=(int) {}
	void operator>>=(int) {}

	void Bar() {};
};

void operator +(A, A) {};

char operator""_z(char) { return 0; }
char g = 's'_z;

template <typename> void function_template() {}

void
functions()
{
	&functions;

	new int;
	new int[1];
	delete (int*) nullptr;
	delete[] (int*) nullptr;

	new SOperators;
	new SOperators[1];
	delete (SOperators*) nullptr;
	delete[] (SOperators*) nullptr;

	SOperators f;
	(int) f;
	f[0];
	*f;
	f->Bar();
	f->*(0);

	f++;
	++f;
	f--;
	--f;
	+f;
	-f;

	f + 0;
	f - 0;
	f * 0;
	f / 0;
	f % 0;
	f += 0;
	f -= 0;
	f *= 0;
	f /= 0;
	f %= 0;

	~f;
	f ^ 0;
	f & 0;
	f | 0;
	f ^= 0;
	f &= 0;
	f |= 0;

	f = 0;
	f , 0;

	f && 0;
	f || 0;
	f < 0;
	f > 0;
	f == 0;
	f <= 0;
	f >= 0;
	f != 0;

	f << 0;
	f >> 0;
	f <<= 0;
	f >>= 0;
}

int variable_global;
template<auto& variable_template> struct C4 {};

void
variables(int parameter)
{
	int x;
	x = parameter;
	struct S { int s; };
}

void literals()
{
	int x = 0;
	x = 0ull;
	x = 0xff;
	x = 0b0011'0000;
	x = (-1) + (+1);
	x = 0 ? 0 : 0;

	float y = 0.0f;
	y = (-1e-6) + (+1e+6);

	char* z = "string" "\n\t" "%u %.2f";
	char w = '0' + '\0';
	auto a = nullptr;
}

void
enums()
{
	enum FooEnum { Value };
	int x = FooEnum::Value;
}

// Comment
/// Comment
/* Block comment */
/** Block comment */

/// @brief foo
/// @returns foo
/// @param foo foo

/**
 * @brief foo
 * @returns foo
 * @param foo foo
 * @param[in] foo foo
 * TODO:
 */

namespace Space { int member; }
void
namespaces()
{
	using namespace Space;
	int x = Space::member;

	std::vector<int> x;
}

int main() {}

#endif
```

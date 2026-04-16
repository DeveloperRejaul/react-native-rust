#include "add_rust.h"
#include <iostream>

int main(int argc, char const *argv[])
{
    int result = add_rust(10, 20);
    std::cout << result << std::endl;
    return 0;
}

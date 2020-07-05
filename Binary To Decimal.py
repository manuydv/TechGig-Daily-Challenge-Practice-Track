You will be getting a binary number as an input and you need to convert it into a decimal number. 

Input Format
You will be taking a binary number as an input. 

Constraints
1 < N < 10^9

Output Format
Print the decimal number to the stdout. 

Sample TestCase 1

Input
110
Output
6


num = input()
num = num[::-1]

multiply = []
for i in reversed(range(len(num))):
    multiply.append(int(num[i])*(2**i))

print(sum(multiply), end = "")
